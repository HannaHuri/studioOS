"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const chartData = [
  { month: "Jan", thisYear: 8200, lastYear: 6100 },
  { month: "Feb", thisYear: 9400, lastYear: 7300 },
  { month: "Mar", thisYear: 7800, lastYear: 6800 },
  { month: "Apr", thisYear: 10200, lastYear: 7500 },
  { month: "May", thisYear: 11500, lastYear: 8200 },
  { month: "Jun", thisYear: 9800, lastYear: 7900 },
  { month: "Jul", thisYear: 8600, lastYear: 6400 },
  { month: "Aug", thisYear: 10800, lastYear: 8100 },
  { month: "Sep", thisYear: 12200, lastYear: 9300 },
  { month: "Oct", thisYear: 11000, lastYear: 8700 },
  { month: "Nov", thisYear: 13500, lastYear: 9800 },
  { month: "Dec", thisYear: 14200, lastYear: 10500 },
]

const chartConfig = {
  thisYear: {
    label: "This Year",
    color: "hsl(217, 91%, 60%)",
  },
  lastYear: {
    label: "Last Year",
    color: "hsl(213, 97%, 75%)",
  },
} satisfies ChartConfig

export function IncomeChart() {
  const [period, setPeriod] = useState("6")

  const filteredData = useMemo(
    () => chartData.slice(0, Number(period)),
    [period]
  )

  return (
    <Card className="transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle>Your Income</CardTitle>
        <CardDescription>
          Monthly income — this year vs last year
        </CardDescription>
        <CardAction>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[350px] w-full">
          <BarChart data={filteredData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="thisYear"
              fill="var(--color-thisYear)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="lastYear"
              fill="var(--color-lastYear)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
