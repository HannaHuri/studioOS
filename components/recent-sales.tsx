import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const projects = [
  {
    name: "App Redesign",
    client: "Wix",
    avatar: "/studioOS/logos/wix.png",
    status: "In Progress" as const,
    deadline: "Apr 12",
  },
  {
    name: "Brand Identity",
    client: "Monday",
    avatar: "/studioOS/logos/monday.png",
    status: "In Review" as const,
    deadline: "Apr 5",
  },
  {
    name: "Marketing Kit",
    client: "Fiverr",
    avatar: "/studioOS/logos/fiverr.png",
    status: "In Progress" as const,
    deadline: "Apr 18",
  },
  {
    name: "Dashboard UI",
    client: "Slack",
    avatar: "/studioOS/logos/slack.png",
    status: "In Review" as const,
    deadline: "Apr 2",
  },
  {
    name: "Social Templates",
    client: "Meta",
    avatar: "/studioOS/logos/meta.png",
    status: "In Progress" as const,
    deadline: "Apr 24",
  },
  {
    name: "Landing Page",
    client: "Zoom",
    avatar: "/studioOS/logos/zoom.png",
    status: "In Progress" as const,
    deadline: "Apr 30",
  },
]

export function RecentSales() {
  return (
    <Card className="transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle>Active Projects</CardTitle>
        <CardDescription>
          {projects.length} projects in progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {projects.map((project) => (
            <div key={project.name} className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarImage src={project.avatar} alt={project.client} />
                <AvatarFallback>{project.client[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">
                  {project.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {project.client}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  project.status === "In Review"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                )}
              >
                {project.status}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground w-14 text-right">
                {project.deadline}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
