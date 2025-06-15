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


// 2️⃣ User schema & model
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, default: "manager" },
});

const User = mongoose.model("users", userSchema);

// 3️⃣ Category schema (used inside sectors)
const CategorySchema = new mongoose.Schema({
  name: String,
  monthly: {
    type: Map,
    of: {
      budget: Number,
      expense: Number
    }
  },
  yearly: {
    type: Map,
    of: {
      budget: Number,
      expense: Number
    }
  }
});

const SectorSchema = new mongoose.Schema({
  sectorName: String,
  categories: [CategorySchema]
});

const CompanySchema = new mongoose.Schema({
  name: String,
  location: String,
  userEmail: String,
  userName: String,
  image: String,
  sectors: [SectorSchema]
});

const Company = mongoose.model("companies", CompanySchema);
// 5️⃣ Signup API
app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

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

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send({ error: "Email already registered" });
  }

  try {
    const newUser = new User({ email, password, name });
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

  if (email === CEO_EMAIL && password === CEO_PASSWORD) {
    return res.send({
      message: "CEO login successful",
      role: "ceo",
      name: "CEO",
      email: CEO_EMAIL,
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send({ error: "User not found" });
  }
  if (user.password !== password) {
    return res.status(400).send({ error: "Invalid password" });
  }

  const userData = { ...user._doc };
  delete userData.password;
  res.send({
    message: "Manager login successful",
    ...userData,
    role: "manager",
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
      image,
      userEmail,
      userName,
    });
    await newCompany.save();
    res.send({ message: "Company added successfully" });
  } catch (error) {
    res.status(500).send({ error: "Error saving company" });
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
    if (role === "ceo") {
      companies = await Company.find(); // ✅ CEO sees all
    } else {
      companies = await Company.find({ userEmail }); // ✅ Manager sees only their companies
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

//updatye yearly data
app.post("/company/:companyId/update-yearly-category", async (req, res) => {
  const { companyId } = req.params;
  const { sectorIndex, categoryIndex, month, yearlyBudget, yearlyExpense } = req.body;

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });

    const sector = company.sectors[sectorIndex];
    if (!sector) return res.status(404).send({ error: "Sector not found" });

    const category = sector.categories[categoryIndex];
    if (!category) return res.status(404).send({ error: "Category not found" });

    if (!(category.yearly instanceof Map)) {
      category.yearly = new Map(Object.entries(category.yearly || {}));
    }

    category.yearly.set(month, {
      budget: Number(yearlyBudget),
      expense: Number(yearlyExpense),
    });

    company.markModified(`sectors.${sectorIndex}.categories.${categoryIndex}.yearly`);

    await company.save();
    res.send({ message: "Yearly data updated", category });
  } catch (err) {
    console.error("Error updating yearly:", err);
    res.status(500).send({ error: "Failed to update yearly data" });
  }
});


//update category monthly data
app.post('/company/:id/update-cat', async (req, res) => {
  const { id } = req.params;
  const { sectorIndex, categoryIndex, month, monthlyBudget, monthlyExpense } = req.body;

  try {
    const company = await Company.findById(id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const category = company.sectors[sectorIndex]?.categories[categoryIndex];
    if (!category) return res.status(404).json({ message: 'Category not found' });

    if (!(category.monthly instanceof Map)) {
      category.monthly = new Map(Object.entries(category.monthly || {}));
    }

    category.monthly.set(month, {
      budget: Number(monthlyBudget),
      expense: Number(monthlyExpense)
    });

    // ✅ This is CRUCIAL
    company.markModified(`sectors.${sectorIndex}.categories.${categoryIndex}.monthly`);

    await company.save();
    res.json({ message: 'Monthly data updated', category });
  } catch (err) {
    console.error('Error updating monthly data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





// 🔥  Add a new category to a company
app.post("/company/:id/add-category", async (req, res) => {
  const { id } = req.params;
  const { sectorIndex, categoryName } = req.body;

  if (sectorIndex === undefined || !categoryName) {
    return res.status(400).json({ message: "Sector index and category name are required" });
  }

  try {
    const company = await Company.findById(id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Check if sector index exists
    if (!company.sectors || !company.sectors[sectorIndex]) {
      return res.status(400).json({ message: "Sector not found at given index" });
    }

    // Push the new category into the selected sector
    company.sectors[sectorIndex].categories.push({
      name: categoryName,
      monthly: {},
      yearly: {},
    });

    await company.save();
    res.status(200).json(company);
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


//  Delete specific yearly or monthly data from a category
app.post("/company/:companyId/delete-category-data", async (req, res) => {
  const { companyId } = req.params;
  const { categoryIndex, type, key } = req.body; // key = month name or year
  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });
    const category = company.categories[categoryIndex];
    if (!category) return res.status(404).send({ error: "Category not found" });
    if (type === "monthly") {
      if (category.monthly?.[key]) {
        delete category.monthly[key];
        company.markModified(`categories.${categoryIndex}.monthly`);
      } else {
        return res
          .status(400)
          .send({ error: "Month not found in monthly data" });
      }
    } else if (type === "yearly") {
      if (category.yearly?.[key]) {
        delete category.yearly[key];
        company.markModified(`categories.${categoryIndex}.yearly`);
      } else {
        return res.status(400).send({ error: "Year not found in yearly data" });
      }
    } else {
      return res.status(400).send({ error: "Invalid type" });
    }

    await company.save();
    res.send({ message: "Data deleted successfully", category });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// deleting yearly data
// ✅ Delete specific year entry from a category
app.post("/company/:companyId/delete-year", async (req, res) => {
  const { companyId } = req.params;
  const { categoryIndex, yearKey } = req.body;

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });

    const category = company.categories[categoryIndex];
    if (!category) return res.status(404).send({ error: "Category not found" });

    if (category.yearly && category.yearly[yearKey]) {
      delete category.yearly[yearKey];
      company.markModified(`categories.${categoryIndex}.yearly`);
    } else {
      return res.status(400).send({ error: "Year entry not found" });
    }

    await company.save();
    res.send({ message: "Year entry deleted successfully" });
  } catch (err) {
    console.error("Error deleting year:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

//deleting monthling data
app.post("/company/:companyId/delete-month", async (req, res) => {
  const { companyId } = req.params;
  const { categoryIndex, monthKey } = req.body;

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });

    const category = company.categories[categoryIndex];
    if (!category) return res.status(404).send({ error: "Category not found" });

    // ✅ Convert monthly to Map if it's not already
    if (!(category.monthly instanceof Map)) {
      category.monthly = new Map(Object.entries(category.monthly || {}));
    }

    if (category.monthly.has(monthKey)) {
      category.monthly.delete(monthKey);
    } else {
      return res.status(400).send({ error: "Month not found in monthly data" });
    }

    await company.save();

    res.send({ message: "Month data deleted", category });
  } catch (err) {
    console.error("Error deleting month:", err);
    res.status(500).send({ error: "Failed to delete month" });
  }
});

// Dashboard Route
app.get("/dashboard", async (req, res) => {
  const { userEmail, role } = req.query;
  if (!userEmail || !role) {
    return res.status(400).send({ error: "userEmail and role are required" });
  }

  try {
    const companies = role === "ceo"
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





// Category Comparison Route
app.get("/category-comparison", async (req, res) => {
  const { userEmail, role } = req.query;

  try {
    const companies = role === "ceo"
      ? await Company.find()
      : await Company.find({ userEmail });

    const categoryTotals = {};

    companies.forEach((company) => {
      if (company.sectors && Array.isArray(company.sectors)) {
        company.sectors.forEach((sector) => {
          if (sector.categories && Array.isArray(sector.categories)) {
            sector.categories.forEach((cat) => {
              const categoryName = cat.name;

              if (!categoryTotals[categoryName]) {
                categoryTotals[categoryName] = {
                  yearlyBudget: 0,
                  yearlyExpense: 0,
                };
              }

              const yearly = cat.yearly || {};
              const plainYearly = JSON.parse(JSON.stringify(yearly));

              Object.values(plainYearly).forEach((entry) => {
                categoryTotals[categoryName].yearlyBudget += Number(entry.budget || 0);
                categoryTotals[categoryName].yearlyExpense += Number(entry.expense || 0);
              });
            });
          }
        });
      }
    });

    const result = Object.entries(categoryTotals).map(([name, values]) => ({
      categoryName: name,
      yearlyBudget: values.yearlyBudget,
      yearlyExpense: values.yearlyExpense,
    }));

    res.send(result);
  } catch (err) {
    console.error("Error in /category-comparison:", err);
    res.status(500).send({ error: "Server error during category comparison" });
  }
});





// ✅ Start server
const PORT = 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
