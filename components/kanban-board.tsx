"use client"

import { useState } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { CalendarDays, GripVertical, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Status =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "In Review"
  | "Approved"
  | "In Dev"
  | "Done"

const STATUSES: Status[] = [
  "Backlog",
  "To Do",
  "In Progress",
  "In Review",
  "Approved",
  "In Dev",
  "Done",
]

type Priority = "High" | "Medium" | "Low"

interface Task {
  id: string
  title: string
  project: string
  client: string
  priority: Priority
  due: string
  assignee: { name: string; initials: string; color: string }
}

const HANI = { name: "Hani Buskila", initials: "HB", color: "bg-blue-500" }
const MAYA = { name: "Maya", initials: "M", color: "bg-pink-500" }
const JON = { name: "Jon", initials: "J", color: "bg-emerald-500" }
const ADA = { name: "Ada", initials: "A", color: "bg-violet-500" }

const initialTasks: Record<Status, Task[]> = {
  Backlog: [
    { id: "t1", title: "Explore onboarding flow variants", project: "App Redesign", client: "Wix", priority: "Medium", due: "Apr 20", assignee: HANI },
    { id: "t2", title: "Collect references for pricing page", project: "Landing Page", client: "Zoom", priority: "Low", due: "Apr 25", assignee: MAYA },
  ],
  "To Do": [
    { id: "t3", title: "Wireframe dashboard widgets", project: "Dashboard UI", client: "Slack", priority: "High", due: "Apr 8", assignee: HANI },
    { id: "t4", title: "Define empty states for feed", project: "Social Templates", client: "Meta", priority: "Medium", due: "Apr 12", assignee: JON },
    { id: "t5", title: "Draft logo direction A", project: "Brand Identity", client: "Monday", priority: "High", due: "Apr 6", assignee: ADA },
  ],
  "In Progress": [
    { id: "t6", title: "Redesign profile settings screen", project: "App Redesign", client: "Wix", priority: "High", due: "Apr 10", assignee: HANI },
    { id: "t7", title: "Build email header templates", project: "Marketing Kit", client: "Fiverr", priority: "Medium", due: "Apr 15", assignee: MAYA },
  ],
  "In Review": [
    { id: "t8", title: "Final logo presentation", project: "Brand Identity", client: "Monday", priority: "High", due: "Apr 5", assignee: ADA },
    { id: "t9", title: "Analytics chart components", project: "Dashboard UI", client: "Slack", priority: "Medium", due: "Apr 7", assignee: HANI },
  ],
  Approved: [
    { id: "t10", title: "Checkout flow hand-off pack", project: "App Redesign", client: "Wix", priority: "High", due: "Apr 9", assignee: HANI },
  ],
  "In Dev": [
    { id: "t11", title: "Navigation shell components", project: "Dashboard UI", client: "Slack", priority: "Medium", due: "Apr 4", assignee: JON },
  ],
  Done: [
    { id: "t12", title: "Icon set v2", project: "Marketing Kit", client: "Fiverr", priority: "Low", due: "Mar 30", assignee: MAYA },
    { id: "t13", title: "Color tokens audit", project: "Brand Identity", client: "Monday", priority: "Low", due: "Mar 28", assignee: ADA },
  ],
}

const columnAccent: Record<Status, string> = {
  Backlog: "bg-slate-400",
  "To Do": "bg-zinc-500",
  "In Progress": "bg-blue-500",
  "In Review": "bg-orange-500",
  Approved: "bg-purple-500",
  "In Dev": "bg-teal-500",
  Done: "bg-emerald-500",
}

const priorityStyles: Record<Priority, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
}

export function KanbanBoard() {
  const [columns, setColumns] =
    useState<Record<Status, Task[]>>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function findContainer(id: string): Status | undefined {
    if ((STATUSES as string[]).includes(id)) return id as Status
    return STATUSES.find((s) => columns[s].some((t) => t.id === id))
  }

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string
    const container = findContainer(id)
    if (container) {
      const task = columns[container].find((t) => t.id === id)
      if (task) setActiveTask(task)
    }
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return
    }

    setColumns((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIdx = activeItems.findIndex((t) => t.id === activeId)
      if (activeIdx === -1) return prev

      let newIdx: number
      if ((STATUSES as string[]).includes(overId)) {
        // dropped directly on a column — append at end
        newIdx = overItems.length
      } else {
        const overIdx = overItems.findIndex((t) => t.id === overId)
        newIdx = overIdx >= 0 ? overIdx : overItems.length
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((t) => t.id !== activeId),
        [overContainer]: [
          ...overItems.slice(0, newIdx),
          activeItems[activeIdx],
          ...overItems.slice(newIdx),
        ],
      }
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveTask(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer) return

    // Same-column reorder
    if (activeContainer === overContainer) {
      const items = columns[activeContainer]
      const activeIdx = items.findIndex((t) => t.id === activeId)
      const overIdx = items.findIndex((t) => t.id === overId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        setColumns((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIdx, overIdx),
        }))
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({ status, tasks }: { status: Status; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const ids = tasks.map((t) => t.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-card/50 transition-colors",
        isOver && "bg-accent/60 border-primary/30"
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <span
          className={cn("size-2 rounded-full", columnAccent[status])}
        />
        <h3 className="text-sm font-semibold">{status}</h3>
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Add task to ${status}`}
        >
          <Plus />
        </Button>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-3 min-h-24">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskCard task={task} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function TaskCard({
  task,
  dragHandleProps,
  isOverlay,
}: {
  task: Task
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isOverlay?: boolean
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm",
        "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        !isOverlay && "hover:-translate-y-0.5 hover:shadow-md",
        isOverlay && "rotate-1 shadow-lg ring-2 ring-primary/20 cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="-ml-1 mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag task"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.project} · {task.client}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
            priorityStyles[task.priority]
          )}
        >
          {task.priority}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="size-3" />
          {task.due}
        </span>
        <div className="flex-1" />
        <Avatar size="sm">
          <AvatarFallback className={cn("text-white", task.assignee.color)}>
            {task.assignee.initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
