import { Plus, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "@/components/kanban-board"

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Drag tasks between columns to update their status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal />
            Filter
          </Button>
          <Button size="sm">
            <Plus />
            New Task
          </Button>
        </div>
      </div>

      <KanbanBoard />
    </div>
  )
}
