"use client"

export function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-10 w-10 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">대화를 선택하세요</h2>
        <p className="text-muted-foreground text-sm">
          사이드바에서 대화를 선택하거나 새로운 채팅을 시작하세요.
        </p>
      </div>
    </div>
  )
}
