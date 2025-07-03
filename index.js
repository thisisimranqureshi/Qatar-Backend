const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
app.use(express.json({ limit: "10mb" }));
app.use(cors());


const CEO_EMAIL = "ceo@qatar.com";
const CEO_PASSWORD = "ceo123";

// 1️⃣ MongoDB connection
const uri = 'mongodb+srv://cosc221101050kfueitedupk:hCds3Oasgxnxu24X@cluster0.730knqk.mongodb.net/qatar?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri)
.then(() => console.log('Connected to DB'))
.catch((error) => console.error(error));


// 2 User schema & model
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role:{
    type:String,
    enum:["manager","ceo","admin"],
    default:"manager"
  },
  group: String
});

const User = mongoose.model("users", userSchema);


const RevenueEntrySchema = new mongoose.Schema({
  categoryName: String,
  subcategory: String,
  month: String,
  year: Number,
  expectedBudget: Number,
  actualBudget: Number,
}, { _id: false }); // Optional: disable _id for nested docs

const expenseCategorySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Company',
  },
  categoryName: {
    type: String,
    required: true,
  },
});

const CompanySchema = new mongoose.Schema({
  name: String,
  location: String,
  userEmail: String,
  userName: String,
  image: String,
  typeSelection: {
    type: String,
    enum: ['Expense', 'Revenue', null],
    default: null,
  },
  revenueEntries: [RevenueEntrySchema], // Revenue stays the same
  expenseEntries: [                      // ✅ UPDATED
    {
      categoryName: { type: String, required: true },
      subcategories: [
        {
          subcategory: { type: String, required: true },
          month: { type: String, required: true },
          year: { type: String, required: true },
          expectedBudget: { type: Number, required: true },
          actualBudget: { type: Number, required: true }
        }
      ]
    }
  ]
});

//  GET all managers (for CEO dashboard)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, "name email group role");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});






const Company = mongoose.model("companies", CompanySchema);
// 5️⃣ Signup API
app.post("/signup", async (req, res) => {
  const { email, password, name, group,role } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).send({ error: "Valid email is required" });
  }
  if (!password || password.length < 6) {
    return res
      .status(400)
      .send({ error: "Password must be at least 6 characters" });
  }
  if (!name) {
    return res.status(400).send({ error: "Name is required" });
  }
  if (!group || group.trim() === "") {
    return res.status(400).send({ error: "Group is required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send({ error: "Email already registered" });
  }

  try {
    const newUser = new User({ email, password, name, group,role }); // ✅ Add group
    await newUser.save();
    res.send({ message: "Signup successful" });
  } catch (error) {
    res.status(500).send({ error: "Error creating user" });
  }
});

// 6️⃣ Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send({ error: "Email and password are required" });
  }

  // Check hard-coded CEO (legacy)
  if (email === CEO_EMAIL && password === CEO_PASSWORD) {
    return res.send({
      message: "CEO login successful",
      role: "ceo",
      name: "CEO",
      email: CEO_EMAIL,
    });
  }

  // Check DB users
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send({ error: "User not found" });
  }

  if (user.password !== password) {
    return res.status(400).send({ error: "Invalid password" });
  }

  const userData = { ...user._doc };
  delete userData.password;

  let message = "";
  if (user.role === "ceo") {
    message = "CEO login successful";
  } else if (user.role === "admin") {
    message = "Admin login successful";
  } else {
    message = "Manager login successful";
  }

  return res.send({
    message,
    ...userData,
    role: user.role,
  });
});


// 7️⃣ Add a company
app.post("/add-company", async (req, res) => {
  const { name, location, image, userEmail, userName } = req.body;

  if (!name || !location || !userEmail || !userName) {
    return res.status(400).send({ error: "All fields are required" });
  }

  try {
    const newCompany = new Company({
      name,
      location,
      userEmail,
      userName,
    });
    await newCompany.save();
    res.send({ message: "Company added successfully" });
  } catch (error) {
    res.status(500).send({ error: "Error saving company" });
  }
});


// ✅ UPDATE company name route
app.put('/companies/:id', async (req, res) => {
  const companyId = req.params.id;
  const { name } = req.body;

  try {
    const updated = await Company.findByIdAndUpdate(
      companyId,
      { name },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ message: 'Server error updating company' });
  }
});




//updating user data in user
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, group, role } = req.body;

    const updated = await User.findByIdAndUpdate(
      id,
      { name, email, password, group, role },
      { new: true }
    );

    res.status(200).json({ message: "User updated", updated });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// 8️⃣ Get all companies
app.get("/companies", async (req, res) => {
  const { userEmail, role } = req.query;
  if (!userEmail || !role) {
    return res.status(400).send({ error: "User email and role required" });
  }
  try {
    let companies;
    if (role === "ceo" ||role=="admin") {
      companies = await Company.find(); // CEO sees all
    } else {
      companies = await Company.find({ userEmail }); // Manager sees only their companies
    }
    res.send(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).send({ error: "Error fetching companies" });
  }
});

// Delete a company by ID
app.delete("/companies/:companyId", async (req, res) => {
  const { companyId } = req.params;

  try {
    const deletedCompany = await Company.findByIdAndDelete(companyId);
    if (!deletedCompany) {
      return res.status(404).send({ error: "Company not found" });
    }

    res.send({ message: "Company deleted successfully", id: companyId });
  } catch (err) {
    console.error("Error deleting company:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});


//Type-selection
// In index.js or your route handler
app.post('/api/company/select-type', async (req, res) => {
  const { companyId, type } = req.body;

  try {
    if (!['Expense', 'Revenue'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type selected' });
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      { typeSelection: type },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.status(200).json({ message: 'Type saved successfully', company });
  } catch (err) {
    console.error('Error saving type selection:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



//  Get company with categories
app.get("/company/:companyId", async (req, res) => {
  try {
    console.log("Getting company ID:", req.params.companyId); // 👈 Add this
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });
    res.send(company);
  } catch (err) {
    console.error("❌ Error fetching company:", err); // 👈 See full error in terminal
    res.status(500).send({ error: "Error fetching company data" });
  }
});

app.get('/api/revenue/subcategories', async (req, res) => {
  const { companyId, categoryName } = req.query;

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const filtered = company.revenueEntries.filter(entry => entry.categoryName === categoryName);
    res.status(200).json(filtered);
  } catch (err) {
    console.error('Error fetching entries:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/revenue/add-subcategory/:companyId', async (req, res) => {
  const cleanCompanyId = req.params.companyId.trim();
  const {
    categoryName,
    subcategory,
    month,
    year,
    expectedBudget,
    actualBudget,
  } = req.body;

  try {
    const company = await Company.findById(cleanCompanyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    company.revenueEntries.push({
      categoryName,
      subcategory,
      month,
      year,
      expectedBudget,
      actualBudget,
      createdAt: new Date(),
    });

    await company.save();
    res.status(200).json({ message: 'Revenue subcategory added successfully' });
  } catch (error) {
    console.error('Error saving revenue subcategory:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// POST: Add expense subcategory
app.post('/api/expense/add-category/:companyId', async (req, res) => {
  const { companyId } = req.params; // ✅ get from URL
  const { categoryName } = req.body;

  console.log("Received Category Name:", categoryName);
  console.log("Received Company ID:", companyId);

  try {
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // If expenseEntries doesn't exist yet, initialize it
    if (!company.expenseEntries) {
      company.expenseEntries = [];
    }

    // Add the category to the company's expense entries
    company.expenseEntries.push({
      companyId: company._id, // ✅ This fixes the validation error
      categoryName,
    });

    await company.save();

    res.status(201).json({ message: "Expense category added successfully", company });
  } catch (error) {
    console.error("Error adding expense category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




// GET: Get all expense categories for a company
app.get('/api/expense/get-categories/:companyId', async (req, res) => {
  const { companyId } = req.params;

  try {
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Return the embedded expense entries (categories)
    res.status(200).json(company.expenseEntries || []);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.post('/api/expense/add-subcategory/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const {
    categoryName,
    subcategory,
    month,
    year,
    expectedBudget,
    actualBudget,
  } = req.body;

  // 1. Basic Validation
  if (
    !categoryName ||
    !subcategory ||
    !month ||
    !year ||
    expectedBudget === undefined ||
    actualBudget === undefined
  ) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // 2. Find the company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    // 3. Find the category in expenseEntries
    const category = company.expenseEntries.find(entry => entry.categoryName === categoryName);

    if (!category) {
      return res.status(404).json({ message: 'Category not found in expense entries.' });
    }

    // 4. Ensure subcategories array exists
    if (!Array.isArray(category.subcategories)) {
      category.subcategories = [];
    }

    // 5. Push the subcategory
    category.subcategories.push({
      subcategory,
      month,
      year,
      expectedBudget,
      actualBudget,
    });

    // 6. Save the updated company
    await company.save();

    return res.status(200).json({ message: 'Expense subcategory added successfully.', data: company });

  } catch (error) {
    console.error('Error adding expense subcategory:', error);
    return res.status(500).json({ message: 'Internal Server Error.' });
  }
});



app.get('/api/expense/subcategories', async (req, res) => {
  const { companyId, categoryName } = req.query;

  try {
    const company = await Company.findById(companyId.trim());
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const category = company.expenseEntries.find(entry => entry.categoryName === categoryName);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json(category.subcategories);
  } catch (err) {
    console.error('Error fetching expense subcategories:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//editing expense subcategory name 
app.put('/api/expense/update-subcategory/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { oldName, newName, categoryName } = req.body;

  try {
    // Find the company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Find the category inside expenseEntries
    const category = company.expenseEntries.find(entry => entry.categoryName === categoryName);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let modifiedCount = 0;

    // Update subcategory names
    category.subcategories.forEach((subcat) => {
      if (subcat.subcategory === oldName) {
        subcat.subcategory = newName;
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      await company.save();
    }

    res.json({
      success: true,
      modifiedCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error updating subcategory name' });
  }
});









// Dashboard Route
app.get("/dashboard", async (req, res) => {
  const { userEmail, role } = req.query;
  if (!userEmail || !role) {
    return res.status(400).send({ error: "userEmail and role are required" });
  }

  try {
    const companies = role === "ceo"||role=="admin"
      ? await Company.find()
      : await Company.find({ userEmail });

    let totalBudget = 0;
    let totalExpense = 0;
    const yearMap = {};
    const companySummaries = [];

    companies.forEach((company) => {
      let companyBudget = 0;

      if (company.sectors && Array.isArray(company.sectors)) {
        company.sectors.forEach((sector) => {
          if (sector.categories && Array.isArray(sector.categories)) {
            sector.categories.forEach((category) => {
              const yearly = category.yearly || {};

              // ✅ Ensure it's plain object not Mongoose weird object
              const plainYearly = JSON.parse(JSON.stringify(yearly));

              Object.entries(plainYearly).forEach(([year, values]) => {
                const budget = Number(values?.budget || 0);
                const expense = Number(values?.expense || 0);

                if (!yearMap[year]) {
                  yearMap[year] = { year, budget: 0, expense: 0 };
                }

                yearMap[year].budget += budget;
                yearMap[year].expense += expense;

                totalBudget += budget;
                totalExpense += expense;
                companyBudget += budget;
              });
            });
          }
        });
      }

      companySummaries.push({ name: company.name, budget: companyBudget });
    });

    const graphData = Object.values(yearMap).sort((a, b) => parseInt(a.year) - parseInt(b.year));

    res.send({ totalBudget, totalExpense, graphData, companySummaries });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send({ error: "Dashboard error" });
  }
});


//  Start server
const PORT = 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
