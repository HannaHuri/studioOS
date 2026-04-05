import { CheckCircle, ListTodo, Star, Users } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { IncomeChart } from "@/components/income-chart";
import { RecentSales } from "@/components/recent-sales";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tasks Completed"
          value="34"
          change="+12% from last week"
          icon={CheckCircle}
        />
        <StatCard
          title="To Do"
          value="12"
          change="-3 from last week"
          icon={ListTodo}
        />
        <StatCard
          title="Weekly Rating"
          value="4.8"
          change="+0.3 from last week"
          icon={Star}
        />
        <StatCard
          title="Active Clients"
          value="8"
          change="+2 from last month"
          icon={Users}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentSales />
        <IncomeChart />
      </div>
    </div>
  );
}
