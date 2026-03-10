"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2 } from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { addTransaction, TransactionData, addSubscription } from "@/lib/firestoreUtils";

export default function AddTransactionPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("0");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  // Authenticate user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // If someone goes to /add-transaction without being logged in
      if (!currentUser) {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (key === ".") {
      if (!amount.includes(".")) {
        setAmount((prev) => prev + ".");
      }
    } else {
      if (amount === "0") {
        setAmount(key);
      } else {
        if (amount.includes(".")) {
          const [, decimal] = amount.split(".");
          if (decimal?.length >= 2) return;
        }
        if (amount.replace(".", "").length >= 9) return;
        setAmount((prev) => prev + key);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (parseFloat(amount) === 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (!title.trim()) {
      setError("Please fill the above field");
      return;
    }
    setError("");

    setIsSaving(true);
    setIsCategorizing(true);

    try {
      let category = "General";
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          category = data.category || "General";
        }
      } catch (err) {
        console.error("Categorization error:", err);
      }
      
      setIsCategorizing(false);

      const transactionData: TransactionData = {
        type,
        amount_inr: parseFloat(amount),
        title: title.trim(),
        category,
        status: type === "income" ? "received" : "paid",
        date: Timestamp.now(),
        isRecurring: isRecurring && type === "expense",
        isDeleted: false,
      };

      await addTransaction(user.uid, transactionData);

      // If requested, set up the recurring subscription tracking
      if (isRecurring && type === "expense") {
        await addSubscription(user.uid, {
          title: title.trim(),
          amount_inr: parseFloat(amount),
          category: category,
          lastProcessedDate: Timestamp.now()
        });
      }

      router.push("/dashboard");

    } catch (error) {
      console.error("Error saving transaction:", error);
      alert("Failed to save transaction. Please try again.");
      setIsSaving(false);
      setIsCategorizing(false);
    }
  };

  // Full page loader while checking Firebase auth state
  if (authLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // If user is null but not loading, they will be redirected by useEffect
  if (!user) return null;

  return (
    <div className="flex flex-col h-full pb-2">
      <div className="flex-none flex justify-center mb-4">
        <div className="flex bg-gray-100 p-1 rounded-full w-full max-w-[280px]">
          <button
            onClick={() => {
              setType("income");
            }}
            className={`flex-1 py-3 text-sm font-semibold rounded-full transition-colors flex items-center justify-center ${
              type === "income" ? "bg-white text-emerald-600 shadow" : "text-gray-500"
            }`}
          >
            Income
          </button>
          <button
            onClick={() => {
              setType("expense");
            }}
             className={`flex-1 py-3 text-sm font-semibold rounded-full transition-colors flex items-center justify-center ${
              type === "expense" ? "bg-white text-rose-600 shadow" : "text-gray-500"
            }`}
          >
            Expense
          </button>
        </div>
      </div>

      {/* Massive INR Display */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] max-h-[180px] mb-4">
        <span className="text-gray-400 text-sm font-medium mb-2">
          {type === "income" ? "How much did you earn?" : "How much did you spend?"}
        </span>
        <div
          className={`text-6xl sm:text-7xl font-bold tracking-tight flex items-center ${
            type === "income" ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          <span className="opacity-60 text-5xl sm:text-6xl mr-2">₹</span>
          <span>{amount}</span>
        </div>
      </div>

      <div className="flex-none mt-auto space-y-3">
        {/* Title Input */}
        <div className="px-1">
          <input
            type="text"
            placeholder="What was this for? (e.g., Apple Store)"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
            className="w-full bg-white border-2 border-gray-100 text-gray-800 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none shadow-sm transition-all"
            maxLength={40}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        {/* Recurring Toggle (Only for expenses) */}
        {type === "expense" && (
          <div className="flex items-center justify-between py-3 px-2">
            <span className="text-sm text-gray-600 font-medium">Make this a recurring monthly subscription</span>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isRecurring ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isRecurring ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}



        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="bg-white active:bg-gray-100 text-gray-800 text-2xl font-medium py-3 rounded-2xl shadow-sm border border-gray-100 transition-colors touch-manipulation"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => handleKeyPress(".")}
            className="bg-white active:bg-gray-100 text-gray-800 text-3xl font-medium py-3 rounded-2xl shadow-sm border border-gray-100 transition-colors touch-manipulation"
          >
            .
          </button>
          <button
            onClick={() => handleKeyPress("0")}
            className="bg-white active:bg-gray-100 text-gray-800 text-2xl font-medium py-3 rounded-2xl shadow-sm border border-gray-100 transition-colors touch-manipulation"
          >
            0
          </button>
          <button
            onClick={() => handleKeyPress("backspace")}
            className="bg-white active:bg-gray-100 text-gray-800 flex items-center justify-center py-3 rounded-2xl shadow-sm border border-gray-100 transition-colors touch-manipulation"
          >
            <Delete size={22} className="text-gray-700" />
          </button>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`relative w-full text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-2 disabled:opacity-80 flex items-center justify-center ${
            type === "expense"
              ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
              : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              {isCategorizing ? "Analyzing & Saving..." : "Saving..."}
            </>
          ) : (
            "Save Transaction"
          )}
        </button>
      </div>
    </div>
  );
}
