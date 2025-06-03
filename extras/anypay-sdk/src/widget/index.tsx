import React from 'react'

export interface AnyPayWidgetProps {
  name?: string
}

export const AnyPayWidget: React.FC<AnyPayWidgetProps> = ({ name = 'World' }) => {
  return (
    <div className="anypay-hello-world">
      <h1>Hello, {name}!</h1>
      <p>This is a component from the Anypay SDK.</p>
    </div>
  )
}

export default AnyPayWidget
