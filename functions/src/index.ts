import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {initializeApp, cert} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

setGlobalOptions({maxInstances: 10});

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (raw) {
  try {
    initializeApp({credential: cert(JSON.parse(raw))});
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", (e as Error).message);
  }
}
const db = getFirestore();

export const api = onRequest({cors: true}, (req, res) => {
  logger.info("StableSplit Cloud Function invoked", {method: req.method, path: req.path});
  res.json({status: "ok", service: "stablesplit", timestamp: Date.now()});
});

export const onExpenseCreated = onDocumentCreated(
  "groups/{groupId}/expenses/{expenseId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const expense = snap.data();
    logger.info("Expense created", {expenseId: event.params.expenseId, amount: expense.amount});
  }
);

export const onSettlementCompleted = onDocumentCreated(
  "groups/{groupId}/settlementPayments/{paymentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const payment = snap.data();
    if (payment.settlementStatus === "paid" || payment.status === "paid") {
      logger.info("Settlement completed", {
        paymentId: event.params.paymentId,
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
      });
    }
  }
);
