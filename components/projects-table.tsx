"use client"

import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Status = "Discovery" | "Design" | "Review" | "Handoff" | "Done"

interface Project {
  name: string
  subtitle: string
  client: string
  clientLogo: string
  status: Status
  team: { name: string; initials: string; color: string }[]
  due: string
  overdue?: boolean
  tasksDone: number
  tasksTotal: number
}

const projects: Project[] = [
  {
    name: "App Redesign",
    subtitle: "Mobile + Web",
    client: "Wix",
    clientLogo: "/studioOS/logos/wix.png",
    status: "Design",
    team: [
      { name: "Daniel", initials: "D", color: "bg-blue-500" },
      { name: "Maya", initials: "M", color: "bg-pink-500" },
      { name: "Jon", initials: "J", color: "bg-emerald-500" },
    ],
    due: "Apr 12",
    tasksDone: 8,
    tasksTotal: 14,
  },
  {
    name: "Brand Identity",
    subtitle: "Logo system",
    client: "Monday",
    clientLogo: "/studioOS/logos/monday.png",
    status: "Review",
    team: [
      { name: "Daniel", initials: "D", color: "bg-blue-500" },
      { name: "Sara", initials: "S", color: "bg-amber-500" },
    ],
    due: "Apr 5",
    tasksDone: 12,
    tasksTotal: 12,
  },
  {
    name: "Marketing Kit",
    subtitle: "Social + Email",
    client: "Fiverr",
    clientLogo: "/studioOS/logos/fiverr.png",
    status: "Design",
    team: [
      { name: "Maya", initials: "M", color: "bg-pink-500" },
      { name: "Jon", initials: "J", color: "bg-emerald-500" },
      { name: "Ada", initials: "A", color: "bg-violet-500" },
    ],
    due: "Apr 18",
    tasksDone: 4,
    tasksTotal: 10,
  },
  {
    name: "Dashboard UI",
    subtitle: "Analytics module",
    client: "Slack",
    clientLogo: "/studioOS/logos/slack.png",
    status: "Handoff",
    team: [{ name: "Daniel", initials: "D", color: "bg-blue-500" }],
    due: "Apr 2",
    overdue: true,
    tasksDone: 18,
    tasksTotal: 18,
  },
  {
    name: "Social Templates",
    subtitle: "Story + Feed",
    client: "Meta",
    clientLogo: "/studioOS/logos/meta.png",
    status: "Discovery",
    team: [
      { name: "Jon", initials: "J", color: "bg-emerald-500" },
      { name: "Ada", initials: "A", color: "bg-violet-500" },
    ],
    due: "Apr 24",
    tasksDone: 2,
    tasksTotal: 8,
  },
  {
    name: "Landing Page",
    subtitle: "Pricing + Hero",
    client: "Zoom",
    clientLogo: "/studioOS/logos/zoom.png",
    status: "Design",
    team: [
      { name: "Daniel", initials: "D", color: "bg-blue-500" },
      { name: "Maya", initials: "M", color: "bg-pink-500" },
    ],
    due: "Apr 30",
    tasksDone: 6,
    tasksTotal: 15,
  },
]

const statusStyles: Record<Status, string> = {
  Discovery:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Design:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Review:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Handoff:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Done: "bg-muted text-muted-foreground",
}

const tabs = [
  { label: "All", value: "all" as const },
  { label: "Discovery", value: "Discovery" as const },
  { label: "Design", value: "Design" as const },
  { label: "Review", value: "Review" as const },
  { label: "Handoff", value: "Handoff" as const },
]

type TabValue = (typeof tabs)[number]["value"]

export function ProjectsTable() {
  const [active, setActive] = useState<TabValue>("all")

  const filtered =
    active === "all"
      ? projects
      : projects.filter((p) => p.status === active)

  const countFor = (v: TabValue) =>
    v === "all"
      ? projects.length
      : projects.filter((p) => p.status === v).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Projects</CardTitle>
        <CardDescription>
          {projects.length} projects in progress across 6 clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 px-6">
          {tabs.map((t) => {
            const isActive = active === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setActive(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground hover:bg-accent"
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    "text-[11px]",
                    isActive
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {countFor(t.value)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-medium">Project</th>
                <th className="px-3 py-3 text-left font-medium">Client</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-left font-medium">Team</th>
                <th className="px-3 py-3 text-left font-medium">Due Date</th>
                <th className="px-3 py-3 text-left font-medium">Tasks</th>
                <th className="w-12 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.name}
                  className={cn(
                    "group hover:bg-muted/40 transition-colors",
                    i < filtered.length - 1 && "border-b border-border"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold leading-tight">
                        {p.name}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {p.subtitle}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage src={p.clientLogo} alt={p.client} />
                        <AvatarFallback>{p.client[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.client}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        statusStyles[p.status]
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <AvatarGroup>
                      {p.team.map((m) => (
                        <Avatar key={m.name} size="sm">
                          <AvatarFallback
                            className={cn("text-white", m.color)}
                          >
                            {m.initials}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        p.overdue && "text-destructive"
                      )}
                    >
                      {p.due}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground tabular-nums">
                    {p.tasksDone}/{p.tasksTotal}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More options"
                    >
                      <MoreHorizontal />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
