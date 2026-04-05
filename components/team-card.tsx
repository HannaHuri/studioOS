import Image from "next/image"
import { Instagram, Linkedin, Youtube } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TeamMember {
  name: string
  role: string
  photo?: string
  fallbackColor?: string
  socials?: {
    instagram?: string
    linkedin?: string
    youtube?: string
  }
}

export function TeamCard({ member }: { member: TeamMember }) {
  const initials = member.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-col items-center justify-between gap-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md">
      {/* Photo */}
      {member.photo ? (
        <Image
          src={member.photo}
          alt={member.name}
          width={160}
          height={160}
          className="size-40 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex size-40 shrink-0 items-center justify-center rounded-full text-3xl font-semibold text-white",
            member.fallbackColor ?? "bg-muted text-muted-foreground"
          )}
        >
          {initials}
        </div>
      )}

      {/* Content */}
      <div className="flex w-full flex-col items-start gap-2">
        <h3 className="text-lg font-semibold leading-7">{member.name}</h3>
        <p className="text-sm leading-5 text-foreground whitespace-pre-line">
          {member.role}
        </p>
      </div>

      {/* Socials */}
      <div className="flex w-full items-center gap-3">
        {member.socials?.instagram && (
          <a
            href={member.socials.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label={`${member.name} on Instagram`}
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            <Instagram className="size-4" />
          </a>
        )}
        {member.socials?.linkedin && (
          <a
            href={member.socials.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label={`${member.name} on LinkedIn`}
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            <Linkedin className="size-4" />
          </a>
        )}
        {member.socials?.youtube && (
          <a
            href={member.socials.youtube}
            target="_blank"
            rel="noreferrer"
            aria-label={`${member.name} on YouTube`}
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            <Youtube className="size-4" />
          </a>
        )}
      </div>
    </div>
  )
}
