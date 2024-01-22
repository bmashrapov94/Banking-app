const express = require('express');
const exphbs = require("express-handlebars");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const app = express();
const PORT = process.env.PORT || 3000;
const randomstring = require("randomstring");
const Handlebars = require("handlebars");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Client = require("./models/Client");
const userObj = JSON.parse(fs.readFileSync("./user.json"));
const acctObj = JSON.parse(fs.readFileSync("./accounts.json"));
const strRandom = randomstring.generate();
const MongoClient = require("mongodb").MongoClient;
const uri =
  "mongodb+srv://bektursun08:Manitoba0805@cluster0.cvu5fh6.mongodb.net/WebBank";
require("dotenv").config();

// Middleware for body parsing and static files
app.engine(
  "hbs",
  exphbs({
    extname: "hbs",
    defaultLayout: false,
    layoutsDir: path.join(__dirname, "views/layouts"),
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: "secretkey",
    resave: true,
    saveUninitialized: false,
  })
);

async function getAccountDataFromDb(user) {
  let chequingAccount, savingsAccount;

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db("mongodatabase");
    const result = await db.collection("client").findOne({ Username: user });

    chequingAccount = result.Chequing;
    savingsAccount = result.Savings;
  } catch (err) {
    console.log(`err = ${err}`);
  }

  return { chequingAccount, savingsAccount };
}

const home = require("./homePage.js");
app.use("/", home);

// Login page
app.post("/login", async (req, res) => {
  const user = req.body.username;
  const password = req.body.password;
  req.session.username = req.body.username;

  const hbshelpers = require("./hbs-helpers.js");
  hbshelpers.newAccountDisabled();
  hbshelpers.noAccountDisabled();
  hbshelpers.checked();

  let chequingAccount, savingsAccount;
  const result = await getAccountDataFromDb(user);
  chequingAccount = result.chequingAccount;
  savingsAccount = result.savingsAccount;

  //validate username and password; if correct, redirect to bankAccount.hbs
  if (userObj[user] === password) {
    res.render("bankAccount", { user, chequingAccount, savingsAccount });
  } else if (!userObj[user]) {
    res.render("login", { message: "Not a registered username" });
  } else {
    res.render("login", { message: "Invalid password" });
  }
});

app.get("/main", async (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;

    // Fetch client accounts from MongoDB
    const client = await Client.findOne({ username: username });
    let clientAccounts = [];
    if (client) {
      if (client.chequing)
        clientAccounts.push({ number: client.chequing, type: "Chequing" });
      if (client.savings)
        clientAccounts.push({ number: client.savings, type: "Savings" });
    }

    // Retrieve and clear messages from session
    const successMessage = req.session.successMessage;
    const errorMessage = req.session.errorMessage;
    req.session.successMessage = null;
    req.session.errorMessage = null;

    // Render the banking page with client accounts
    res.render("banking", {
      username,
      successMessage,
      errorMessage,
      clientAccounts,
    });
  } else {
    res.redirect("/");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Register page
app.post("/register", (req, res) => {
  const { email, newPassword } = req.body;

  if (userData.hasOwnProperty(email)) {
    return res.redirect("/register?error=User already exists.");
  }

  userData[email] = newPassword;
  fs.writeFileSync("user.json", JSON.stringify(userData, null, 2));

  res.redirect("/register?success=true");
});

app.get("/register", (req, res) => {
  let successMessage = req.query.success ? "Successfully registered!" : null;
  let errorMessage = req.query.error || null;

  res.render("register", {
    successMessage: successMessage,
    errorMessage: errorMessage,
  });
});

// Balance page
app.get("/balance", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;

    const accountData = JSON.parse(fs.readFileSync("account.json", "utf8"));

    if (accountData.hasOwnProperty(accountNumber)) {
      const account = accountData[accountNumber];
      res.render("balance", {
        username,
        accountNumber,
        accountType: account.accountType,
        balanceData: account.accountBalance,
      });
    } else {
      req.session.errorMessage = "Account not found";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

app.post("/balance", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountID =
      req.body.accountNumber || req.session.actionData.accountNumber;
    const accountData = readAccountsData();

    if (accountData[accountID]) {
      res.redirect(`/balance?accountNumber=${encodeURIComponent(accountID)}`);
    } else {
      req.session.errorMessage = "Invalid account number";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

// Deposit page
app.get("/deposit", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;
    const depositMessage = req.session.depositMessage;

    req.session.depositMessage = null;

    res.render("deposit", { username, accountNumber, depositMessage });
  } else {
    res.redirect("/");
  }
});

// Handle successful deposit
app.post("/deposit", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountNumber = req.body.accountNumber;
    const depositAmount = parseFloat(req.body.depositAmount);

    const accountData = readAccountsData();

    if (
      !isNaN(depositAmount) &&
      depositAmount > 0 &&
      accountData.hasOwnProperty(accountNumber)
    ) {
      accountData[accountNumber].accountBalance += depositAmount;
      fs.writeFileSync("account.json", JSON.stringify(accountData, null, 2));

      const depositMessage = `Deposit Successful: $${depositAmount} deposited to account ${accountNumber}`;

      res.render("deposit", {
        username: req.session.username,
        accountNumber,
        depositMessage,
        depositAmount,
      });
    } else {
      const depositMessage = "Invalid deposit amount or account not found";

      res.render("deposit", {
        username: req.session.username,
        accountNumber,
        depositMessage,
      });
    }
  } else {
    res.redirect("/");
  }
});

// Withdrawal page
app.get("/withdrawal", (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountNumber = req.query.accountNumber;
    const withdrawalSuccessMessage = req.session.withdrawalSuccessMessage;
    const errorMessage = req.session.errorMessage;

    const accountData = readAccountsData();
    if (accountData.hasOwnProperty(accountNumber)) {
      const account = accountData[accountNumber];

      const balance = account.accountBalance;

      res.render("withdrawal", {
        username,
        accountNumber,
        withdrawalSuccessMessage,
        errorMessage,
        balance,
      });
    } else {
      req.session.errorMessage = "Account not found";
      res.redirect("/main");
    }
  } else {
    res.redirect("/");
  }
});

app.post("/withdrawal", (req, res) => {
  if (req.session.isAuthenticated) {
    const accountNumber = req.body.accountNumber;
    const withdrawalAmount = parseFloat(req.body.withdrawalAmount);

    const accountData = readAccountsData();

    if (
      !isNaN(withdrawalAmount) &&
      withdrawalAmount > 0 &&
      accountData.hasOwnProperty(accountNumber)
    ) {
      const account = accountData[accountNumber];

      if (withdrawalAmount <= account.accountBalance) {
        account.accountBalance -= withdrawalAmount;
        fs.writeFileSync("account.json", JSON.stringify(accountData, null, 2));

        const withdrawalSuccessMessage = `Withdrawal Successful: $${withdrawalAmount} withdrawn from account ${accountNumber}`;

        res.render("withdrawal", {
          username: req.session.username,
          accountNumber,
          withdrawalSuccessMessage,
          balance: account.accountBalance,
        });
      } else {
        const errorMessage = "Insufficient Funds";

        res.render("withdrawal", {
          username: req.session.username,
          accountNumber,
          errorMessage,
          balance: account.accountBalance,
          insufficientFundsMessage: errorMessage,
        });
      }
    } else {
      const errorMessage = "Invalid withdrawal amount or account not found";

      res.render("withdrawal", {
        username: req.session.username,
        accountNumber,
        errorMessage,
        balance: accountData[accountNumber].accountBalance,
      });
    }
  } else {
    res.redirect("/");
  }
});

// Open Account page

// Function to read the current accounts data from the JSON file
function readAccountsData() {
  return JSON.parse(fs.readFileSync("account.json", "utf8"));
}

// Function to write updated accounts data to the JSON file
function writeAccountsData(data) {
  fs.writeFileSync("account.json", JSON.stringify(data, null, 2), "utf8");
}

// Function to generate a new unique account number
function generateNewAccountNumber(existingAccountNumbersSet) {
  const minAccountNumber = 100000; // Minimum account number
  const maxAccountNumber = 999999; // Maximum account number
  const maxAttempts = maxAccountNumber - minAccountNumber + 1;

  let attempts = 0;
  let newAccountNumber;

  do {
    newAccountNumber =
      Math.floor(Math.random() * (maxAccountNumber - minAccountNumber + 1)) +
      minAccountNumber;
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error(
        "Unable to generate a unique account number: all numbers are in use."
      );
    }
  } while (existingAccountNumbersSet.has(newAccountNumber));

  return newAccountNumber;
}

app.post("/openAccount", async (req, res) => {
  if (req.session.isAuthenticated) {
    const username = req.session.username;
    const accountType = req.body.accountType;

    try {
      const client = await Client.findOne({ username: username });

      if (client) {
        if (
          (accountType === "Chequing" && client.chequing) ||
          (accountType === "Savings" && client.savings)
        ) {
          req.session.errorMessage = "Client already has this type of account";
          res.redirect("/main");
        } else {
          // Fetch all existing account numbers
          const existingAccounts = await Client.find({}, "chequing savings"); // Modify as per your schema
          const existingAccountNumbersSet = new Set(
            existingAccounts
              .map((acc) => acc.chequing)
              .concat(existingAccounts.map((acc) => acc.savings))
          );

          // Generate a new account number
          const newAccountNumber = generateNewAccountNumber(
            existingAccountNumbersSet
          );

          // Assign the new account number to the appropriate field
          if (accountType === "Chequing") {
            client.chequing = newAccountNumber;
          } else {
            client.savings = newAccountNumber;
          }

          await client.save();

          // Set success message
          req.session.successMessage = `New ${accountType} account created with number: ${newAccountNumber}`;

          // Redirect back to the main page after creating the account
          res.redirect("/main");
        }
      } else {
        req.session.errorMessage = "Client not found";
        res.redirect("/");
      }
    } catch (error) {
      console.error(error);
      req.session.errorMessage = "An error occurred";
      res.redirect("/");
    }
  } else {
    res.redirect("/");
  }
});

app.get("/openAccount", (req, res) => {
  if (req.session.isAuthenticated) {
    res.render("openAccount", { username: req.session.username });
  } else {
    res.redirect("/");
  }
});

// Port listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

