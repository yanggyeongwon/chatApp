import { NextResponse } from "next/server"
import { readdirSync, statSync } from "fs"
import { join, relative } from "path"

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", ".obsidian", "dist",
  "dist-electron", ".cache", ".turbo", "coverage",
])

const IGNORE_FILES = new Set([
  ".DS_Store", "Thumbs.db",
])

function walkDir(dir: string, base: string, results: string[], maxDepth: number, depth = 0) {
  if (depth > maxDepth || results.length > 5000) return

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || IGNORE_FILES.has(entry)) continue

      const fullPath = join(dir, entry)
      const relPath = relative(base, fullPath)

      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          results.push(relPath + "/")
          // Hidden dirs (start with .): only go 1 level deep
          const isHidden = entry.startsWith(".")
          const subMaxDepth = isHidden ? Math.min(depth + 1, maxDepth) : maxDepth
          if (depth < subMaxDepth) {
            walkDir(fullPath, base, results, subMaxDepth, depth + 1)
          }
        } else {
          results.push(relPath)
        }
      } catch {
        // skip inaccessible files
      }
    }
  } catch {
    // skip inaccessible dirs
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") ?? ""
  const dir = searchParams.get("dir") ?? ""
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/"
  const cwd = dir || homeDir

  const allFiles: string[] = []
  try {
    walkDir(cwd, cwd, allFiles, 4)
  } catch {
    return NextResponse.json({ files: [], cwd, total: 0, error: "Invalid directory" })
  }

  let filtered: string[] = []
  if (query && query.endsWith("/")) {
    // Folder query: directly read this folder's children
    const folderPath = join(cwd, query)
    try {
      const entries = readdirSync(folderPath)
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry) || IGNORE_FILES.has(entry)) continue
        try {
          const stat = statSync(join(folderPath, entry))
          filtered.push(query + entry + (stat.isDirectory() ? "/" : ""))
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  } else if (query) {
    // Text search across all files
    const lower = query.toLowerCase()
    filtered = allFiles.filter((f) => f.toLowerCase().includes(lower))
  } else {
    // No query: show top-level items only
    filtered = allFiles.filter((f) => {
      const parts = f.replace(/\/$/, "").split("/")
      return parts.length === 1
    })
  }

  // Sort: directories first, then files, alphabetically
  filtered.sort((a, b) => {
    const aDir = a.endsWith("/")
    const bDir = b.endsWith("/")
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.localeCompare(b)
  })

  return NextResponse.json({
    files: filtered.slice(0, 100),
    cwd,
    total: filtered.length,
  })
}
