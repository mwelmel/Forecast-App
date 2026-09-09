import type { ReactNode } from 'react'

type FormFieldProps = {
  id: string
  label: string
  children: ReactNode
}

function FormField({ id, label, children }: FormFieldProps) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

export default FormField
