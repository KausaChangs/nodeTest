// Import required modules
import express, { response } from "express";
import apiClient from "./configs/aza_finance.js";
import {
  CurrencyInfoApi,
  TransactionRequest,
  TransactionsApi,
  SendersApi,
  Sender,
  AccountValidationRequest,
  AccountValidationApi,
  PayoutMethodDetails,
  PayoutMethod,
  Recipient,
  SenderRequest,
  Transaction,
  Webhook,
  TransactionWebhook,
  RecipientWebhook,
  PayoutMethodWebhook,
  SenderWebhook,
  DocumentWebhook,
  Debit,
  DebitRequestWrapper,
  AccountDebitsApi,
  RecipientsApi,
} from "transferzero-sdk";

// Create an Express application
const app = express();
const port = 6000; // Port on which the server will run

app.use(express.json());

// Define a sample route : this one is working
app.get("/", (req, res) => {
  let apiInstance = new CurrencyInfoApi(apiClient);
  apiInstance.infoCurrencies().then(
    (data) => {
      return res.json(data);
    },
    (error) => {
      if (error.isValidationError) {
        let result = error.getResponseObject();
        return res.json(result);
      } else {
        res.send("Exception when calling CurrencyInfoApi#infoCurrencies");
      }
    }
  );
});

app.get("/getSender/:id", async (req, res) => {
  let apiInstance = new SendersApi(apiClient);

  apiInstance.getSender(req.params.id).then(
    (data) => {
      res.status(200).json(data);
    },
    (error) => {
      if (error.isValidationError) {
        let result = error.getResponseObject();
        console.log(result);
        console.error(
          "WARN: Validation error occurred when calling the endpoint"
        );
      } else {
        console.error("Exception when calling SendersApi#getSender");
        throw error;
      }
    }
  );
});

app.post("/createSender", async (req, res) => {
  const api = new SendersApi(apiClient);
  const sender = new Sender();

  sender.country = "ZM";
  sender.phone_country = "ZM";
  sender.phone_number = "+260973918510";
  sender.email = "kausa@home.org";
  sender.first_name = "Kausa";
  sender.last_name = "Changaya";
  sender.ip = "127.0.0.1";
  sender.city = "Lusaka";
  sender.street = "20 W 34th St";
  sender.address_description = "Office Address";
  sender.postal_code = "798984";
  sender.birth_date = "1998-12-31";
  sender.documents = [];
  sender.external_id = "primenet-1234998";

  try {
    const senderRequest = new SenderRequest();
    senderRequest.sender = sender;

    const senderResponse = await api.postSenders(senderRequest);

    res.json(senderResponse.object);
  } catch (e) {
    if (e.isValidationError) {
      const senderResponse = e.getResponseObject();
      res.status(500).json(senderResponse.object.errors);
    } else {
      res.status(500).json({ msg: "General error", error: e });
    }
  }
});

app.post("/transactions", async (req, res) => {
  const request = new TransactionRequest();

  request.transaction = req.body;

  const api = new TransactionsApi(apiClient);

  try {
    const response = await api.createAndFundTransaction(request);
    return res.json(response);
  } catch (error) {
    return res.json(error);
  }
});

app.post("/createAndFundTransaction", async (req, res) => {
  const api = new TransactionsApi(apiClient);

  const transaction = new Transaction();

  // When adding a sender to transaction, please use either an id or external_id. Providing both will result in a validation error.
  // Please see our documentation at https://docs.transferzero.com/docs/transaction-flow/#sender
  const sender = new Sender();
  sender.id = "f9e1ab52-fa44-4f3f-b091-ca78f075a9e5";

  // You can find the various payout options at https://docs.transferzero.com/docs/transaction-flow/#payout-details
  const ngnBankDetails = new PayoutMethodDetails();
  ngnBankDetails.bank_account = "123456789";
  ngnBankDetails.bank_account_type = "20";
  ngnBankDetails.bank_code = "082";
  ngnBankDetails.first_name = "First";
  ngnBankDetails.last_name = "Last";

  const payoutMethod = new PayoutMethod();
  payoutMethod.type = "NGN::Bank";
  payoutMethod.details = ngnBankDetails;

  // Please see https://docs.transferzero.com/docs/transaction-flow/#requested-amount-and-currency
  // on what the request amount and currencies do
  const recipient = new Recipient();
  recipient.requested_amount = 15000;
  recipient.requested_currency = "NGN";
  recipient.payout_method = payoutMethod;

  // Similarly you can check https://docs.transferzero.com/docs/transaction-flow/#requested-amount-and-currency
  // on details about the input currency parameter
  transaction.input_currency = "USD";
  transaction.sender = sender;
  transaction.recipients = [recipient];

  // Find more details on external IDs at https://docs.transferzero.com/docs/transaction-flow/#external-id
  transaction.external_id = "EXTRAN-555999778899988";

  try {
    const transactionRequest = new TransactionRequest();
    transactionRequest.transaction = transaction;
    const transactionResponse = await api.postTransactions(transactionRequest);

    if (transactionResponse.object.id != null) {
      // Please see https://docs.transferzero.com/docs/transaction-flow/#funding-transactions
      // on details about funding transactions
      const debit = new Debit();
      debit.currency = transactionResponse.object.input_currency;
      debit.to_id = transactionResponse.object.id;
      debit.to_type = "Transaction";

      const debitRequest = new DebitRequestWrapper();
      debitRequest.debit = debit;

      const debitsApi = new AccountDebitsApi(apiClient);
      try {
        const debitListResponse = await debitsApi.postAccountsDebits(
          debitRequest
        );
        console.log("Transaction Funded Successfully");
        console.log(debitListResponse.object[0]);
        res.json(debitListResponse);
      } catch (e) {
        if (e.isValidationError) {
          const debitListResponse = e.getResponseObject();
          console.error("Transaction could not be funded");
          console.error(debitListResponse.object[0].errors);
        } else {
          console.error(e.error.stack);
        }
      }
    }

    return res.json(transactionResponse);
  } catch (e) {
    return res.json(e);
  }
});

app.delete("/cancelTransaction", async (req, res) => {
  const api = new RecipientsApi(apiClient);
  const recipientid = "93bd361c-4f0b-4ae1-af29-1d57397bae01";

  try {
    const respo = await api.deleteRecipient(recipientid);
    return res.json(respo);
  } catch (e) {
    return res.json(e);
  }
});

app.get("/transactions/:id", async (req, res) => {
  const api = new TransactionsApi(apiClient);

  try {
    const response = await api.getTransactions({ external_id: req.params.id });

    return res.json(response);
  } catch (error) {
    return res.json(error);
  }
});

app.post("/createAndFundTransactionExample", async (req, res) => {
  const api = new TransactionsApi(apiClient);

  // const transactionId = await api.createTransactionExample();

  if (transactionId != null) {
    // Please see https://docs.transferzero.com/docs/transaction-flow/#funding-transactions
    // on details about funding transactions
    const debit = new Debit();
    debit.currency = "GHS";
    debit.to_id = transactionId;
    debit.to_type = "Transaction";

    const debitRequest = new DebitRequestWrapper();
    debitRequest.debit = debit;

    const debitsApi = new AccountDebitsApi(apiClient);
    try {
      const debitListResponse = await debitsApi.postAccountsDebits(
        debitRequest
      );
      console.log("Transaction Funded Successfully");
      console.log(debitListResponse.object[0]);
      res.json(debitListResponse);
    } catch (e) {
      if (e.isValidationError) {
        const debitListResponse = e.getResponseObject();
        console.error("Transaction could not be funded");
        console.error(debitListResponse.object[0].errors);
      } else {
        console.error(e.error.stack);
      }
    }
  }
  return transactionId;
});

//working
app.get("/accountInfo", async (req, res) => {
  const request = new AccountValidationRequest();
  request.bank_account = "9040009999999";

  request.bank_code = "889999999";
  request.country = AccountValidationRequest.CountryEnum.GH;
  request.currency = AccountValidationRequest.CurrencyEnum.GHS;
  request.method = AccountValidationRequest.MethodEnum.BANK;
  const api = new AccountValidationApi(apiClient);
  try {
    const response = await api.postAccountValidations(request);
    res.json(response);
  } catch (e) {
    res.status(500).json(e);
  }
});

app.delete("/recipient/:id", (req, res) => {});

let opts = { external_id: "EXTRAN-5557" };

//let opts = { externalId: 'EXTSEN-5555' };

app.get("/findSenderByExternalId", async (req, res) => {
  // Find more details on external IDs at https://docs.transferzero.com/docs/transaction-flow/#external-id

  const api = new SendersApi(apiClient, {});

  try {
    const response = await api.getSenders(opts);
    response.object.forEach((sender) => console.log(sender));
    res.json(response);
  } catch (e) {
    res.json(e);
  }
});

app.get("/getTransactionStatus", (req, res) => {
  const webhookHeader = {
    "Authorization-Nonce": "authorization-nonce",
    "Authorization-Key": "authorization-key",
    "Authorization-Signature": "authorization-signature",
  };

  const webhookUrl = "http://webhook.url";

  const webhookContent = `{
        "webhook": "02b769ff-ffff-ffff-ffff-820d285d76c7",
        "event": "transaction.created",
        "object": {
          "id": "9170b966-ffff-ffff-ffff-7af5ad7e335f",
          "metadata": {},
          "state": "approved",
          "input_amount": 50.00,
          "input_currency": "EUR",
          "sender": {
            "id": "4be2a144-ffff-ffff-ffff-8ebcbfbbbe0c",
            "type": "person",
            "state": "initial",
            "state_reason": null,
            "country": "GB",
            "street": "Test",
            "postal_code": "EH1 1TT",
            "city": "London",
            "phone_country": "GB",
            "phone_number": "+447123456789",
            "email": "test@example.com",
            "ip": "127.0.0.1",
            "first_name": "Test",
            "last_name": "Name",
            "birth_date": "1990-01-01",
            "metadata": {},
            "providers": {}
          },
          "payin_methods": [],
          "paid_amount": 50.00,
          "due_amount": 0,
          "recipients": [
            {
              "id": "69dee5aa-ffff-ffff-ffff-0a2c06353c6b",
              "transaction_id": "9170b966-ffff-ffff-ffff-7af5ad7e335f",
              "created_at": "2017-07-24T15:08:58Z",
              "input_usd_amount": 60.00,
              "state": "initial",
              "transaction_state": "initial",
              "requested_amount": 50.00,
              "requested_currency": "EUR",
              "input_amount": 50.00,
              "input_currency": "EUR",
              "output_amount": 20001,
              "output_currency": "NGN",
              "payout_method": {
                "id": "c67580ee-ffff-ffff-ffff-ac51f1d0c035",
                "type": "NGN::Bank",
                "details": {
                  "email": "",
                  "bank_code": "011",
                  "last_name": "Test",
                  "first_name": "User",
                  "bank_account": "1111111111",
                  "bank_account_type": "10"
                },
                "metadata": {},
                "provider": "interswitch",
                "fields": {
                  "email": {
                    "type": "input",
                    "validations": {
                      "format": "\\\\A((\\\\w+([\\\\-+.]\\\\w+)*@[a-zA-Z0-9]+([\\\\-\\\\.][a-zA-Z0-9]+)*)*){3,320}\\\\z"
                    }
                  },
                  "first_name": {
                    "type": "input",
                    "validations": {
                      "presence": true
                    }
                  },
                  "last_name": {
                    "type": "input",
                    "validations": {
                      "presence": true
                    }
                  },
                  "bank_code": {
                    "type": "select",
                    "options": {
                      "063": "Diamond Bank",
                      "050": "EcoBank",
                      "214": "FCMB Bank",
                      "070": "Fidelity Bank",
                      "011": "First Bank of Nigeria",
                      "058": "Guaranty Trust Bank ",
                      "030": "Heritage Bank",
                      "301": "Jaiz Bank",
                      "082": "Keystone ",
                      "014": "Mainstreet ",
                      "076": "Skye Bank",
                      "039": "Stanbic IBTC Bank ",
                      "232": "Sterling bank",
                      "032": "Union Bank",
                      "033": "United Bank for Africa ",
                      "215": "Unity Bank",
                      "035": "Wema Bank",
                      "057": "Zenith International "
                    },
                    "validations": {
                      "presence": true,
                      "inclusion": {
                        "in": {
                          "063": "Diamond Bank",
                          "050": "EcoBank",
                          "214": "FCMB Bank",
                          "070": "Fidelity Bank",
                          "011": "First Bank of Nigeria",
                          "058": "Guaranty Trust Bank ",
                          "030": "Heritage Bank",
                          "301": "Jaiz Bank",
                          "082": "Keystone ",
                          "014": "Mainstreet ",
                          "076": "Skye Bank",
                          "039": "Stanbic IBTC Bank ",
                          "232": "Sterling bank",
                          "032": "Union Bank",
                          "033": "United Bank for Africa ",
                          "215": "Unity Bank",
                          "035": "Wema Bank",
                          "057": "Zenith International "
                        }
                      }
                    }
                  },
                  "bank_account": {
                    "type": "input",
                    "validations": {
                      "presence": true
                    }
                  },
                  "bank_account_type": {
                    "type": "select",
                    "options": {
                      "20": "Current",
                      "10": "Savings"
                    },
                    "validations": {
                      "presence": true,
                      "inclusion": {
                        "in": {
                          "20": "Current",
                          "10": "Savings"
                        }
                      }
                    }
                  }
                }
              },
              "metadata": {}
            }
          ],
          "created_at": "2017-07-24T15:08:58Z",
          "expires_at": "2017-07-24T16:08:58Z"
        }
      }`;

  // Once setting up an endpoint where you'll be receiving callbacks you can use the following code snippet
  // to both verify that the webhook we sent out is legitimate, and then parse it's contents regardless of type.

  // The details you need to provide are:
  // - the body of the webhook/callback you received as a string
  // - the url of your webhook, where you are awaiting the callbacks - this has to be the full URL
  // - the authentication headers you have received on your webhook endpoint - as an object
  try {
    if (apiClient.validateRequest(webhookUrl, webhookContent, webhookHeader)) {
      const webhook = apiClient.parseResponseString(webhookContent, Webhook);

      if (webhook.event.startsWith("transaction")) {
        const transactionWebhook = apiClient.parseResponseString(
          webhookContent,
          TransactionWebhook
        );
        console.log(transactionWebhook);
      } else if (webhook.event.startsWith("recipient")) {
        const recipientWebhook = apiClient.parseResponseString(
          webhookContent,
          RecipientWebhook
        );
        console.log(recipientWebhook);
      } else if (webhook.event.startsWith("payout_method")) {
        const payoutMethodWebhook = apiClient.parseResponseString(
          webhookContent,
          PayoutMethodWebhook
        );
        console.log(payoutMethodWebhook);
      } else if (webhook.event.startsWith("sender")) {
        const senderWebhook = apiClient.parseResponseString(
          webhookContent,
          SenderWebhook
        );
        console.log(senderWebhook);
      } else if (webhook.event.startsWith("document")) {
        const documentWebhook = apiClient.parseResponseString(
          webhookContent,
          DocumentWebhook
        );
        console.log(documentWebhook);
      }
    }
  } catch (error) {
    console.log("Could not verify webhook signature");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
