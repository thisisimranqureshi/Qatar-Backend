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

// 3️⃣ Category schema for each company
const categorySchema = new mongoose.Schema({
  name: String,
  monthly: {
    type: Map,
    of: new mongoose.Schema(
      {
        budget: Number,
        expense: Number,
      },
      { _id: false }
    ),
  },
  yearly: {
    type: Map,
    of: new mongoose.Schema(
      {
        budget: Number,
        expense: Number,
      },
      { _id: false }
    ),
  },
});

const companySchema = new mongoose.Schema({
  name: String,
  location: String,
  userEmail: String,
  userName: String,
  image: String, // ✅ ADD THIS LINE
  categories: [
    {
      name: String,
      monthly: {
        type: Object,
        default: {},
      },
      yearly: {
        type: Object,
        default: {},
      },
    },
  ],
});


const Company = mongoose.model("companies", companySchema);

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

//Add Category
app.post("/company/:companyId/add-category", async (req, res) => {
  const { companyId } = req.params;
  const { name } = req.body;

  if (!name)
    return res.status(400).send({ error: "Category name is required" });

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });

    company.categories.push({ name, monthly: {}, yearly: {} });
    await company.save();

    res.send(company);
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).send({ error: "Failed to add category" });
  }
});

app.post("/company/:companyId/update-yearly", async (req, res) => {
  const { companyId } = req.params;
  const { categoryIndex, year, yearlyBudget, yearlyExpense } = req.body;

  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });

    const category = company.categories[categoryIndex];
    if (!category) return res.status(404).send({ error: "Category not found" });

    category.yearly.set(year, {
      budget: Number(yearlyBudget),
      expense: Number(yearlyExpense),
    });

    await company.save();
    res.send({ message: "Yearly data updated", category });
  } catch (err) {
    console.error("Error updating yearly:", err);
    res.status(500).send({ error: "Failed to update yearly data" });
  }
});

app.post("/company/:id/update-category", async (req, res) => {
  try {
    const {
      categoryIndex,
      month,
      year,
      monthlyBudget,
      monthlyExpense,
      yearlyBudget,
      yearlyExpense,
    } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) return res.status(404).send("Company not found");

    const category = company.categories[categoryIndex];
    if (!category) return res.status(404).send("Category not found");

    // ✅ Ensure monthly and yearly are plain objects
    if (!category.monthly || typeof category.monthly !== "object")
      category.monthly = {};
    if (!category.yearly || typeof category.yearly !== "object")
      category.yearly = {};

    // ✅ Handle monthly update
    if (month) {
      category.monthly[month] = {
        budget: Number(monthlyBudget || 0),
        expense: Number(monthlyExpense || 0),
      };
      company.markModified(`categories.${categoryIndex}.monthly`);
    }

    // ✅ Handle yearly update
    if (year) {
      category.yearly[year] = {
        budget: Number(yearlyBudget || 0),
        expense: Number(yearlyExpense || 0),
      };
      company.markModified(`categories.${categoryIndex}.yearly`);
    }

    await company.save();
    res.send(company);
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).send("Server error while updating category.");
  }
});

// 🔥  Add a new category to a company
app.post("/add-category/:companyId", async (req, res) => {
  const { companyId } = req.params;
  const { name, yearlyBudget = 0, yearlyExpense = 0 } = req.body;
  const year = new Date().getFullYear().toString();
  try {
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).send({ error: "Company not found" });
    const newCategory = {
      name,
      yearly: {
        [year]: {
          budget: Number(yearlyBudget),
          expense: Number(yearlyExpense),
        },
      },
      monthly: {},
    };
    company.categories.push(newCategory);
    await company.save();
    res.send({ message: "Category added", company });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Error adding category" });
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

app.get("/dashboard", async (req, res) => {
  const { userEmail, role } = req.query;
  if (!userEmail || !role) return res.status(400).send({ error: "userEmail and role are required" });

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

      company.categories.forEach((category) => {
        const yearly = category.yearly || {};
        
        Object.entries(yearly).forEach(([year, { budget, expense }]) => {
          if (!yearMap[year]) yearMap[year] = { year, budget: 0, expense: 0 };

          yearMap[year].budget += budget;
          yearMap[year].expense += expense;

          // ✅ Add to total for all years
          totalBudget += budget;
          totalExpense += expense;
          companyBudget += budget;
        });
      });

      companySummaries.push({ name: company.name, budget: companyBudget });
    });

    const graphData = Object.values(yearMap).sort((a, b) => parseInt(a.year) - parseInt(b.year));

    res.send({ totalBudget, totalExpense, graphData, companySummaries });
  } catch (error) {
    res.status(500).send({ error: "Dashboard error" });
  }
});



// ✅ Start server
const PORT = 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
