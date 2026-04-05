import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string
  change: string
  icon: LucideIcon
}

export function StatCard({ title, value, change, icon: Icon }: StatCardProps) {
  return (
    <Card className="transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-primary">
          {change}
        </p>
      </CardContent>
    </Card>
  )
}
