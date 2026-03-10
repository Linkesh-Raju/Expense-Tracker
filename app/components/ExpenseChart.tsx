"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Transaction } from "@/lib/firestoreUtils";

interface ExpenseChartProps {
  transactions: Transaction[];
}

const COLORS = [
  "#2563eb", // blue-600
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#06b6d4"  // cyan-500
];

export default function ExpenseChart({ transactions }: ExpenseChartProps) {
  const chartData = useMemo(() => {
    // 1. Filter only expenses
    const expenses = transactions.filter((tx) => tx.type === "expense");

    // 2. Group expenses by category (if missing, use title temporarily)
    const grouped = expenses.reduce((acc: Record<string, number>, curr) => {
      // In this app, many transactions are Uncategorized right now. We group by title in that case to show variety, or by category if valid.
      const key = curr.category === "Uncategorized" ? curr.title || "Other" : curr.category;
      
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key] += curr.amount_inr;
      return acc;
    }, {});

    // 3. Convert mapped object to Recharts array structure, sort by largest
    const data = Object.keys(grouped)
      .map((key) => ({
        name: key,
        value: grouped[key],
      }))
      .sort((a, b) => b.value - a.value);

    return data;
  }, [transactions]);

  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 shadow-lg rounded-xl border border-gray-100 text-sm">
          <p className="font-semibold text-gray-800 capitalize mb-1">{payload[0].name}</p>
          <p className="font-bold text-rose-500">{formatINR(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (!chartData || chartData.length === 0) {
    return null; // Don't render if no expenses
  }

  return (
    <div className="px-4 mt-8">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Spending Breakdown</h2>
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
          {chartData.map((entry, index) => (
             <div key={entry.name} className="flex items-center text-xs font-medium text-gray-600">
               <span 
                 className="w-2.5 h-2.5 rounded-full mr-1.5"
                 style={{ backgroundColor: COLORS[index % COLORS.length] }} 
               />
               <span className="capitalize">{entry.name}</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
