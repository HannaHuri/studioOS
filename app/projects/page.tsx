import { CheckCircle2, Clock, Eye, FolderOpen, Plus, SlidersHorizontal } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { ProjectsTable } from "@/components/projects-table"
import { Button } from "@/components/ui/button"

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            All active projects across your clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal />
            Filter
          </Button>
          <Button size="sm">
            <Plus />
            New Project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value="12"
          change="+3 this month"
          icon={FolderOpen}
        />
        <StatCard
          title="In Review"
          value="4"
          change="Awaiting client feedback"
          icon={Eye}
        />
        <StatCard
          title="Completed"
          value="28"
          change="+8 from last month"
          icon={CheckCircle2}
        />
        <StatCard
          title="Avg. Turnaround"
          value="6.2d"
          change="−1.3 days this quarter"
          icon={Clock}
        />
      </div>

      <ProjectsTable />
    </div>
  )
}
