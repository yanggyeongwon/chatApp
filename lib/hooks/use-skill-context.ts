"use client"

import { createContext, useContext } from "react"

export type SkillContextType = {
  showSkills: boolean
  setShowSkills: (v: boolean) => void
  pendingSkill: string | null
  setPendingSkill: (v: string | null) => void
}

export const SkillContext = createContext<SkillContextType>({
  showSkills: false,
  setShowSkills: () => {},
  pendingSkill: null,
  setPendingSkill: () => {},
})

export const useSkillContext = () => useContext(SkillContext)
