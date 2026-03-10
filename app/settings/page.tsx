"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Loader2 } from "lucide-react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { format, isSameMonth, isSameWeek } from "date-fns";
import { auth } from "@/lib/firebase";
import { subscribeToTransactions, Transaction, subscribeToSubscriptions, Subscription, deleteSubscription } from "@/lib/firestoreUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeframe, setTimeframe] = useState<"This Week" | "This Month" | "All Time">("This Month");

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
    
    const unsubscribeTransactions = subscribeToTransactions(
      user.uid,
      (fetchedTransactions) => {
        setTransactions(fetchedTransactions);
      },
      (error) => {
        console.error("Failed to fetch transactions", error);
      }
    );

    const unsubscribeSubscriptions = subscribeToSubscriptions(
      user.uid,
      (fetchedSubscriptions) => {
        setSubscriptions(fetchedSubscriptions);
      },
      (error) => {
        console.error("Failed to fetch subscriptions", error);
      }
    );

    return () => {
      unsubscribeTransactions();
      unsubscribeSubscriptions();
    };
  }, [user]);

  const handleDeleteSubscription = async (subId: string) => {
    if (!user) return;
    try {
      if (confirm("Are you sure you want to cancel this automatic subscription?")) {
        await deleteSubscription(user.uid, subId);
      }
    } catch (error) {
      console.error("Failed to delete subscription:", error);
      alert("Error cancelling subscription.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
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

  const generatePDF = () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      
      let filteredTransactions = transactions;
      const now = new Date();

      if (timeframe === "This Week") {
        filteredTransactions = transactions.filter(tx => isSameWeek(tx.date.toDate(), now, { weekStartsOn: 1 }));
      } else if (timeframe === "This Month") {
        filteredTransactions = transactions.filter(tx => isSameMonth(tx.date.toDate(), now));
      }

      if (filteredTransactions.length === 0) {
        alert(`No transactions found for ${timeframe}.`);
        setIsGenerating(false);
        return;
      }

      // Calculate totals
      let totalIncome = 0;
      let totalExpenses = 0;

      filteredTransactions.forEach((tx) => {
        if (tx.type === "income") {
          totalIncome += tx.amount_inr;
        } else {
          totalExpenses += tx.amount_inr;
        }
      });

      const netBalance = totalIncome - totalExpenses;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(`Financial Report - ${timeframe}`, 14, 22);

      // User Email & Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated for: ${user.email}`, 14, 30);
      doc.text(`Date: ${format(new Date(), "MMMM dd, yyyy")}`, 14, 35);

      // Totals
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Income: ${formatINR(totalIncome)}`, 14, 50);
      doc.text(`Total Expenses: ${formatINR(totalExpenses)}`, 14, 58);
      doc.text(`Net Balance: ${formatINR(netBalance)}`, 14, 66);

      // Table Data
      const tableColumn = ["Date", "Title", "Type", "Amount (INR)"];
      const tableRows = filteredTransactions.map((tx) => {
        return [
          format(tx.date.toDate(), "yyyy-MM-dd"),
          tx.title,
          tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
          `${tx.type === 'income' ? '+' : '-'}${formatINR(tx.amount_inr)}`
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 75,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235] }, // blue-600
      });

      // Save PDF
      doc.save("Financial_Report.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF report.");
    } finally {
      setIsGenerating(false);
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
    <div className="flex flex-col h-full -mx-4 -mt-6 bg-gray-50 min-h-screen pb-24 relative overflow-y-auto">
      {/* Header */}
      <div className="bg-white pt-12 pb-6 px-6 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-center">
          Settings & Export
        </h1>
      </div>

      <div className="px-4 mt-6 flex-grow flex flex-col space-y-6">
        
        {/* User Info Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center flex-shrink-0">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl mb-3 shadow-inner">
            {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
          </div>
          <p className="text-gray-500 text-sm font-medium">Logged in as</p>
          <p className="text-gray-900 font-bold text-lg text-center break-all">{user?.email}</p>
        </div>

        {/* Export Data feature block */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Financial Reports</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">
            Download a complete history of your transactions including total income, expenses, and net balance.
          </p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Timeframe</label>
            <div className="relative">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="w-full bg-gray-50 border-2 border-gray-100 text-gray-800 rounded-2xl p-4 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:bg-white focus:outline-none appearance-none transition-all"
              >
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="All Time">All Time</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
          
          <button
            onClick={generatePDF}
            disabled={isGenerating || transactions.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:active:scale-100"
          >
            {isGenerating ? (
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
            ) : (
              <Download className="w-6 h-6 mr-3" />
            )}
            Download Full PDF Report
          </button>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Active Subscriptions</h2>
          <p className="text-sm text-gray-500 mb-4 font-medium">
            These expenses are automatically logged to your dashboard every 30 days. Cancel them here to stop automatic billing.
          </p>
          
          {subscriptions.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-4 text-center border-2 border-dashed border-gray-200">
               <p className="text-sm text-gray-500 font-medium">No recurring subscriptions.</p>
            </div>
          ) : (
             <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-800">{sub.title}</h3>
                    <p className="text-sm font-bold text-rose-500">{formatINR(sub.amount_inr)} / month</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteSubscription(sub.id)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors flex-shrink-0"
                    title="Cancel Subscription"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign out section */}
        <div className="mt-8 pt-4 pb-4 flex-shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-bold text-lg py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
