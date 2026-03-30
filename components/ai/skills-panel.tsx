"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type Skill = {
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  command: string
}

export function SkillsPanel({
  onSelectSkill,
}: {
  onSelectSkill: (command: string, displayName: string) => void
}) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ai/skills")
      .then((res) => res.json())
      .then((data) => {
        setSkills(data.skills ?? [])
        setCategories(data.categories ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = skills.filter((s) => {
    const matchSearch =
      !search ||
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.command.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !selectedCategory || s.category === selectedCategory
    return matchSearch && matchCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm">
        <span className="animate-pulse">스킬 목록 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h2 className="text-sm font-bold">Claude Code 스킬</h2>
          <Badge variant="secondary" className="text-[10px]">
            {skills.length}
          </Badge>
        </div>
        <Input
          placeholder="스킬 검색..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
              !selectedCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted border-border"
            )}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                cat === selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {filtered.map((skill) => (
            <button
              key={skill.name}
              onClick={() => onSelectSkill(skill.command, skill.displayName)}
              className="w-full text-left rounded-lg p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{skill.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {skill.displayName}
                    </span>
                    <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {skill.command}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <p className="text-[10px] text-muted-foreground text-center">
          스킬을 클릭하면 채팅에 자동 입력됩니다
        </p>
      </div>
    </div>
  )
}
