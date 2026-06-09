import { NextRequest } from "next/server";
import { verifyAuth, okResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const DEMO_MEMBER_NAMES = ["Lou", "Ada", "John", "Sarah", "Mike"];
const DEMO_WALLETS: Record<string, string> = {
  Lou: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  Ada: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  John: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  Sarah: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  Mike: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);

    const existingSnap = await adminDb.collection("groups")
      .where("name", "==", "Weekend Trip")
      .where("isDemo", "==", true)
      .get();

    if (!existingSnap.empty) {
      return okResponse({ groupId: existingSnap.docs[0].id, existing: true });
    }

    const now = Date.now();
    const members = DEMO_MEMBER_NAMES.map((name) => ({
      id: `member-${crypto.randomUUID()}`,
      displayName: name,
      walletAddress: DEMO_WALLETS[name] || undefined,
      avatarColor: undefined,
      createdAt: now,
    }));

    const wallets: Record<string, string> = {};
    for (const m of members) {
      if (m.walletAddress) {
        wallets[m.displayName] = m.walletAddress;
        wallets[m.id] = m.walletAddress;
      }
    }

    const memberAddresses = members
      .map((m) => m.walletAddress?.toLowerCase())
      .filter(Boolean) as string[];

    const groupRef = await adminDb.collection("groups").add({
      name: "Weekend Trip",
      description: "Sample group demonstrating expense sharing and Arc settlement.",
      members,
      memberWallets: wallets,
      memberAddresses,
      currency: "USD",
      isDemo: true,
      createdAt: serverTimestamp(),
    });
    const groupId = groupRef.id;

    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "group.created",
      actorName: "StableSplit",
      description: "Weekend Trip was created.",
      metadata: { groupName: "Weekend Trip", currency: "USD", memberCount: 5, isDemo: true },
      createdAt: serverTimestamp(),
    });

    for (const m of members) {
      await adminDb.collection("groups").doc(groupId).collection("activity").add({
        groupId,
        eventType: "member.added",
        actorName: "StableSplit",
        description: `${m.displayName} was added to the group.`,
        metadata: { memberId: m.id, memberName: m.displayName },
        createdAt: serverTimestamp(),
      });
    }

    const expenses = [
      { description: "Hotel Booking", amount: 150, paidBy: "Ada", category: "accommodation" },
      { description: "Dinner", amount: 60, paidBy: "Lou", category: "food" },
      { description: "Taxi Ride", amount: 30, paidBy: "Sarah", category: "transport" },
      { description: "Movie Tickets", amount: 80, paidBy: "John", category: "entertainment" },
      { description: "Coffee Run", amount: 25, paidBy: "Mike", category: "food" },
    ];

    for (const exp of expenses) {
      await adminDb.collection("groups").doc(groupId).collection("expenses").add({
        groupId,
        description: exp.description,
        amount: exp.amount,
        paidBy: exp.paidBy,
        splitAmong: DEMO_MEMBER_NAMES,
        category: exp.category,
        date: now,
        notes: "",
        createdAt: serverTimestamp(),
      });
    }

    return okResponse({ groupId, existing: false }, 201);
  } catch (error) {
    return handleError(error, "demo.POST");
  }
}
