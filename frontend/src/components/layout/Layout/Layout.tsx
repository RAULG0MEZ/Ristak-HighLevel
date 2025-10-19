import React from 'react'

interface LayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ sidebar, children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-[rgba(148,163,184,0.12)]">
        {sidebar}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
