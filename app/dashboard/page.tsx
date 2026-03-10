"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, isSameMonth } from "date-fns";
import { 
  Bell, 
  TrendingUp, 
  TrendingDown,
  CalendarDays,
  CreditCard,
  ShoppingCart,
  Coffee,
  Car,
  Wallet,
  Home,
  Monitor,
  Gift,
  MoreHorizontal,
  Loader2,
  Plus
} from "lucide-react";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToTransactions, Transaction, subscribeToBills, Bill, addBill, deleteBill, addTransaction, checkAndProcessSubscriptions } from "@/lib/firestoreUtils";
import { Timestamp } from "firebase/firestore";
import ExpenseChart from "../components/ExpenseChart";

export default function DashboardPage() {
  const router = useRouter();
  const currentDate = new Date();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal State
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillDate, setNewBillDate] = useState("");

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

    // Run the lazy-evaluation engine for subscriptions on load
    checkAndProcessSubscriptions(user.uid);

    const unsubscribeTransactions = subscribeToTransactions(
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

    const unsubscribeBills = subscribeToBills(
      user.uid,
      (fetchedBills) => {
        setBills(fetchedBills);
      },
      (error) => {
        console.error("Failed to fetch bills", error);
      }
    );

    return () => {
      unsubscribeTransactions();
      unsubscribeBills();
    };
  }, [user]);

  // Derived calculations
  const summary = useMemo(() => {
    // Only include transactions from the current month
    const currentMonthTransactions = transactions.filter(tx => 
      isSameMonth(tx.date.toDate(), currentDate)
    );

    return currentMonthTransactions.reduce(
      (acc, curr) => {
        if (curr.type === "income") {
          acc.income += curr.amount_inr;
          acc.balance += curr.amount_inr;
        } else {
          acc.expenses += curr.amount_inr;
          acc.balance -= curr.amount_inr;
        }
        return acc;
      },
      { income: 0, expenses: 0, balance: 0 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);



  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Food":
      case "Groceries": return { icon: ShoppingCart, color: "text-rose-500", bg: "bg-rose-100" };
      case "Transport":
      case "Fuel": return { icon: Car, color: "text-orange-500", bg: "bg-orange-100" };
      case "Entertainment": return { icon: Coffee, color: "text-purple-500", bg: "bg-purple-100" };
      case "Rent":
      case "Utilities": return { icon: Home, color: "text-blue-500", bg: "bg-blue-100" };
      case "Salary":
      case "Investment": return { icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-100" };
      case "Client Project": return { icon: Monitor, color: "text-emerald-600", bg: "bg-emerald-100" };
      case "Gift": return { icon: Gift, color: "text-amber-500", bg: "bg-amber-100" };
      default: return { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100" };
    }
  };

  const handleAddBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount_inr = parseFloat(newBillAmount);
    if (!newBillName || isNaN(amount_inr) || amount_inr <= 0 || !newBillDate) {
      alert("Please fill all fields correctly.");
      return;
    }
    
    // Calculate days left
    const dueDate = new Date(newBillDate);
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    try {
      await addBill(user.uid, {
        vendor: newBillName,
        amount_inr,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        //@ts-ignore
        isDeleted: false
      });
      setIsBillModalOpen(false);
      setNewBillName("");
      setNewBillAmount("");
      setNewBillDate("");
    } catch (error) {
      console.error("Failed to add bill", error);
    }
  };

  const handlePayBill = async (bill: Bill) => {
    if (!user) return;
    try {
      await addTransaction(user.uid, {
        type: "expense",
        amount_inr: bill.amount_inr,
        title: bill.vendor,
        category: "Bills",
        status: "paid",
        date: Timestamp.now(),
        isRecurring: false,
        isDeleted: false
      });
      await deleteBill(user.uid, bill.id);
    } catch (error) {
      console.error("Failed to pay bill", error);
      alert("Error paying bill.");
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-6 space-y-6 bg-gray-50 min-h-screen pb-24 relative overflow-y-auto">
      {dataLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Header section with blue gradient background */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 pt-12 pb-24 px-6 rounded-b-[40px] shadow-lg relative mb-16 shadow-blue-900/20">
        <div className="flex justify-between items-center mb-6">
          <div className="text-blue-100 text-sm font-medium tracking-wide flex items-center gap-2">
            <CalendarDays size={16} />
            {format(currentDate, "MMMM yyyy")}
          </div>
          <button className="bg-white/20 p-2 rounded-full backdrop-blur-sm text-white hover:bg-white/30 transition shadow-sm">
            <Bell size={20} />
          </button>
        </div>

        <div>
          <p className="text-blue-100 text-sm mb-1 font-medium">Total Balance</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight flex items-baseline truncate">
            <span className="text-3xl mr-1 text-blue-200">₹</span>
            {summary.balance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </h1>
        </div>

        {/* Floating Summary Cards Grid */}
        <div className="absolute -bottom-12 left-0 right-0 px-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 shadow-gray-200/50 block w-full overflow-hidden">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <TrendingUp size={14} />
                </div>
                Income
              </div>
              <p className="text-lg sm:text-xl font-bold text-gray-800 truncate">
                {formatINR(summary.income)}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 shadow-gray-200/50 block w-full overflow-hidden">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                 <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                  <TrendingDown size={14} />
                </div>
                Expenses
              </div>
              <p className="text-lg sm:text-xl font-bold text-gray-800 truncate">
                {formatINR(summary.expenses)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ExpenseChart transactions={transactions} />

      {/* Upcoming Bills Widget */}
      <div className="px-4 mt-8">
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">Upcoming Bills</h2>
            <button 
              onClick={() => setIsBillModalOpen(true)}
              className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <Link href="/history" className="text-sm text-blue-600 font-semibold">See All</Link>
        </div>
        
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar -mx-4 px-4">
          {bills.length === 0 ? (
            <div className="min-w-[200px] w-full bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center text-gray-500 py-8">
              No upcoming bills.
            </div>
          ) : bills.map((bill) => (
            <div 
              key={bill.id} 
              className="min-w-[200px] bg-white rounded-3xl p-5 shadow-sm border border-gray-100 snap-center flex-shrink-0"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-xl">
                  <CreditCard size={18} />
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                  Due in {bill.daysLeft}d
                </span>
              </div>
              <h3 className="font-semibold text-gray-800 text-base mb-1 truncate">{bill.vendor}</h3>
              <p className="text-lg font-bold text-gray-900 mb-4">{formatINR(bill.amount_inr)}</p>
              <button 
                onClick={() => handlePayBill(bill)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 text-sm font-semibold py-2.5 rounded-xl border border-gray-200 transition active:scale-95"
              >
                Pay Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 flex-grow">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
          <Link href="/history" className="text-sm text-blue-600 font-semibold flex-shrink-0">View All</Link>
        </div>

        <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
          {transactions.length === 0 && !dataLoading ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm font-medium">No transactions yet.</p>
              <p className="text-xs mt-1">Add your first transaction!</p>
            </div>
          ) : (
            transactions.slice(0, 10).map((tx, index) => {
              const { icon: Icon, color, bg } = getCategoryIcon(tx.category);
              return (
                <div 
                  key={tx.id} 
                  className={`flex items-center justify-between p-3 ${
                    index !== Math.min(transactions.length - 1, 9) ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
                      <Icon size={24} />
                    </div>
                    <div className="truncate">
                      <h3 className="font-semibold text-gray-800 text-base truncate">{tx.title}</h3>
                      <p className="text-xs text-gray-500 font-medium truncate">
                        {tx.category} • {format(tx.date.toDate(), "MMM dd")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`font-bold text-base flex items-center justify-end ${
                      tx.type === 'income' ? 'text-emerald-600' : 'text-gray-900'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount_inr)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Add Bill Modal */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Add Upcoming Bill</h2>
            <form onSubmit={handleAddBillSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Bill Name</label>
                <input
                  type="text"
                  required
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  placeholder="e.g. Netflix"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Amount (INR)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newBillAmount}
                  onChange={(e) => setNewBillAmount(e.target.value)}
                  placeholder="e.g. 499"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={newBillDate}
                  onChange={(e) => setNewBillDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="flex-1 px-4 py-3.5 rounded-2xl font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3.5 rounded-2xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
