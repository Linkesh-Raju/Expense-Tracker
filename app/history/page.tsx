"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Loader2,
  Trash2,
  TrendingUp,
  TrendingDown
} from "lucide-react";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToTransactions, Transaction, deleteTransaction } from "@/lib/firestoreUtils";

export default function HistoryPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"All" | "Income" | "Expense">("All");

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Firestore Subscription
  useEffect(() => {
    if (!user) return;
    
    setDataLoading(true);
    const unsubscribe = subscribeToTransactions(
      user.uid,
      (fetchedTransactions) => {
        setTransactions(fetchedTransactions);
        setDataLoading(false);
      },
      (error) => {
        console.error("Failed to fetch transactions", error);
        setDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (transactionId: string) => {
    if (!user) return;
    try {
      await deleteTransaction(user.uid, transactionId);
    } catch (error) {
      console.error("Error deleting transaction", error);
    }
  };

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === "All") return true;
    if (activeTab === "Income" && tx.type === "income") return true;
    if (activeTab === "Expense" && tx.type === "expense") return true;
    return false;
  });

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-6 bg-gray-50 min-h-screen pb-24 relative overflow-y-auto">
      {dataLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Header section */}
      <div className="bg-white pt-12 pb-6 px-6 shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-center">
          Transaction History
        </h1>
        
        {/* Segmented Control */}
        <div className="mt-6 flex bg-gray-100 p-1 rounded-xl">
          {(["All", "Income", "Expense"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
          {filteredTransactions.length === 0 && !dataLoading ? (
            <div className="py-12 text-center text-gray-500">
              <p className="text-base font-medium">No transactions found.</p>
              <p className="text-sm mt-1">Try changing the filter or add a new transaction.</p>
            </div>
          ) : (
            filteredTransactions.map((tx, index) => {
              const isIncome = tx.type === 'income';
              const Icon = isIncome ? TrendingUp : TrendingDown;
              const bg = isIncome ? 'bg-green-100' : 'bg-red-100';
              const color = isIncome ? 'text-green-600' : 'text-red-600';
              const pillBg = isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

              return (
                <div 
                  key={tx.id} 
                  className={`flex items-center justify-between p-3 ${
                    index !== filteredTransactions.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
                      <Icon size={24} />
                    </div>
                    <div className="truncate">
                      <h3 className="capitalize font-semibold text-gray-800 text-base truncate">{tx.title}</h3>
                      <div className="flex items-center gap-2 mt-1 truncate">
                        <span className={`${pillBg} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0`}>
                          {tx.type}
                        </span>
                        <span className="text-xs text-gray-500 font-medium truncate">
                          {format(tx.date.toDate(), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className={`font-bold text-base flex items-center justify-end ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount_inr)}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDelete(tx.id)}
                      className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
