import { TeamCard, type TeamMember } from "@/components/team-card"

const team: TeamMember[] = [
  {
    name: "Hani Buskila",
    role: "UI UX Designer &\nFront-End Developer",
    photo: "/studioOS/team/hani.jpg",
    socials: {
      instagram: "https://instagram.com",
      linkedin: "https://linkedin.com",
      youtube: "https://youtube.com",
    },
  },
  {
    name: "Tal Rosen",
    role: "Co-Founder & CEO",
    fallbackColor: "bg-blue-500",
    socials: {
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "Noa Meir",
    role: "Co-Founder & COO",
    fallbackColor: "bg-pink-500",
    socials: {
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "Daniel Cohen",
    role: "Senior UI UX Designer",
    fallbackColor: "bg-emerald-500",
    socials: {
      instagram: "https://instagram.com",
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "Maya Levi",
    role: "Senior UI UX Designer",
    fallbackColor: "bg-violet-500",
    socials: {
      instagram: "https://instagram.com",
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "Jon Ashkenazi",
    role: "Front-End Developer",
    fallbackColor: "bg-amber-500",
    socials: {
      linkedin: "https://linkedin.com",
      youtube: "https://youtube.com",
    },
  },
  {
    name: "Ada Katz",
    role: "Front-End Developer",
    fallbackColor: "bg-teal-500",
    socials: {
      linkedin: "https://linkedin.com",
    },
  },
  {
    name: "Sara Ben-David",
    role: "Project Manager",
    fallbackColor: "bg-rose-500",
    socials: {
      linkedin: "https://linkedin.com",
    },
  },
]

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          {team.length} people in the studio, shipping design with AI every day
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {team.map((member) => (
          <TeamCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  )
}
