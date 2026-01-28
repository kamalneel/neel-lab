import { Link } from 'react-router-dom';
import { useEffect } from 'react';

// Project data - only Option Pundit is active for now
const projects = [
  {
    id: 'option-pundit',
    title: 'Option Pundit',
    emoji: '📊',
    description: 'Your AI-powered options strategy advisor. Analyze your portfolio and get actionable recommendations for covered calls and puts.',
    status: 'live' as const,
    path: '/option-pundit',
    tags: ['Options', 'Trading', 'Finance'],
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    id: 'estate-planner',
    title: 'Estate Planner',
    emoji: '🏛️',
    description: 'Comprehensive estate planning tools for asset distribution, trust management, and legacy planning.',
    status: 'coming-soon' as const,
    path: null,
    tags: ['Estate', 'Planning', 'Finance'],
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'habit-tracker',
    title: 'Habit Forge',
    emoji: '⚡',
    description: 'Build and track habits with streak tracking, analytics, and motivational insights.',
    status: 'coming-soon' as const,
    path: null,
    tags: ['Productivity', 'Habits', 'Self-Improvement'],
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'ai-journal',
    title: 'Reflect AI',
    emoji: '📝',
    description: 'AI-powered journaling companion that helps you reflect, grow, and understand your thought patterns.',
    status: 'coming-soon' as const,
    path: null,
    tags: ['AI', 'Journaling', 'Mental Health'],
    gradient: 'from-sky-500 to-blue-600',
  },
];

function ProjectCard({ project }: { project: typeof projects[0] }) {
  const isLive = project.status === 'live';
  
  const CardContent = () => (
    <div 
      className={`
        group relative overflow-hidden rounded-2xl 
        bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
        transition-all duration-300 ease-out
        ${isLive ? 'hover:border-[var(--color-accent)] hover:shadow-glow cursor-pointer' : 'opacity-60'}
      `}
    >
      {/* Gradient accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${project.gradient}`} />
      
      {/* Content */}
      <div className="p-6">
        {/* Header with emoji and status */}
        <div className="flex items-start justify-between mb-4">
          <span className="text-4xl">{project.emoji}</span>
          <span className={`
            text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full
            ${isLive 
              ? 'bg-[var(--color-positive-muted)] text-[var(--color-positive)]' 
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'}
          `}>
            {isLive ? 'Live' : 'Coming Soon'}
          </span>
        </div>
        
        {/* Title */}
        <h3 className={`
          text-xl font-bold mb-2 transition-colors
          ${isLive ? 'text-white group-hover:text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}
        `}>
          {project.title}
        </h3>
        
        {/* Description */}
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-4">
          {project.description}
        </p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {project.tags.map(tag => (
            <span 
              key={tag}
              className="text-xs px-2 py-1 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
            >
              {tag}
            </span>
          ))}
        </div>
        
        {/* Arrow indicator for live projects */}
        {isLive && (
          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[var(--color-accent)] text-2xl">→</span>
          </div>
        )}
      </div>
    </div>
  );
  
  if (isLive && project.path) {
    return (
      <Link to={project.path} className="block">
        <CardContent />
      </Link>
    );
  }
  
  return <CardContent />;
}

export function LandingPage() {
  useEffect(() => {
    document.title = "Neel's Lab - Vibe-Coded Experiments";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--color-accent)] rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600 rounded-full blur-[150px] opacity-30" />
        </div>
        
        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-32">
          {/* Lab badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mb-8 animate-fade-in">
            <span className="text-lg">🧪</span>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Experimental Projects
            </span>
          </div>
          
          {/* Main heading */}
          <h1 className="text-5xl lg:text-7xl font-bold mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="text-white">Neel's </span>
            <span className="text-[var(--color-accent)]">Lab</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-[var(--color-text-secondary)] max-w-2xl leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
            A collection of vibe-coded experiments. Tools built for fun, learning, and solving real problems.
          </p>
          
          {/* Stats or quick info */}
          <div className="flex gap-8 mt-12 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">1</div>
              <div className="text-sm text-[var(--color-text-tertiary)]">Live Project</div>
            </div>
            <div className="w-px bg-[var(--color-border)]" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">3</div>
              <div className="text-sm text-[var(--color-text-tertiary)]">In Development</div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Projects Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
          <span>🚀</span>
          <span>Projects</span>
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <div 
              key={project.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-[var(--color-text-tertiary)] text-sm">
            Built with curiosity and caffeine ☕
          </p>
          <p className="text-[var(--color-text-tertiary)] text-xs mt-2">
            © {new Date().getFullYear()} Neel's Lab
          </p>
        </div>
      </footer>
    </div>
  );
}

