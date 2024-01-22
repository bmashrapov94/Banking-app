const express = require("express");
const router = express.Router();

// Deposit page
router.get("/deposit", (req, res) => {
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
router.post("/deposit", (req, res) => {
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

module.exports = router;
