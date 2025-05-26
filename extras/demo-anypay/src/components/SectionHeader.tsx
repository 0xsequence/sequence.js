import { useState, ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface SectionHeaderProps {
  title: ReactNode
  children?: ReactNode
  defaultOpen?: boolean
  isCollapsible?: boolean
  statusPill?: ReactNode
  noFrame?: boolean
  className?: string // For the root div
  titleContainerClassName?: string // For the div housing title & pill/chevron
  contentContainerClassName?: string // For the div housing children content
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  children,
  defaultOpen = false,
  isCollapsible = false,
  statusPill,
  noFrame = false,
  className = '',
  titleContainerClassName = '', // Default to empty, caller must provide for padding/bg
  contentContainerClassName = '', // Default to empty, caller must provide for padding/bg
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen && isCollapsible)

  const handleHeaderClick = () => {
    if (isCollapsible) {
      setIsOpen(!isOpen)
    }
  }

  const rootClasses = `${noFrame ? '' : 'border border-gray-700/50 rounded-lg'} ${className}`

  let titleEffectiveClasses = `w-full flex items-center justify-between ${titleContainerClassName}`
  if (isCollapsible) {
    titleEffectiveClasses += ' cursor-pointer transition-colors duration-200' // Basic interaction
    // Add hover effect only if it's not a noFrame component (noFrame usually means part of a larger styled area)
    // Or if titleContainerClassName explicitly adds one. For now, let titleContainerClassName handle hover for noFrame.
    if (!noFrame) {
      titleEffectiveClasses += ' hover:bg-gray-700/90' // Default hover for framed accordions
    }
  }

  // Dynamic rounding for the title container if it's part of a frame
  if (!noFrame) {
    if (isCollapsible && isOpen) {
      titleEffectiveClasses += ' rounded-t-lg'
    } else {
      titleEffectiveClasses += ' rounded-lg'
    }
  }

  // Dynamic rounding for the content container if it's part of a frame
  const contentEffectiveClasses = `${contentContainerClassName} ${!noFrame && isCollapsible && isOpen ? 'rounded-b-lg' : ''}`

  return (
    <div className={rootClasses}>
      <div onClick={handleHeaderClick} className={titleEffectiveClasses}>
        {/* Allow title to be a simple string or a more complex ReactNode */}
        {typeof title === 'string' ? <div className="flex items-center text-white font-semibold">{title}</div> : title}
        {statusPill ? (
          statusPill
        ) : isCollapsible ? (
          isOpen ? (
            <ChevronDown className="text-gray-400 h-5 w-5" />
          ) : (
            <ChevronRight className="text-gray-400 h-5 w-5" />
          )
        ) : null}
      </div>

      {isCollapsible && isOpen && children && <div className={contentEffectiveClasses}>{children}</div>}
      {/* If not collapsible, but has children, render them directly. */}
      {/* The contentContainerClassName will provide styling like padding. */}
      {!isCollapsible && children && <div className={contentContainerClassName}>{children}</div>}
    </div>
  )
}
