import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentUpload } from './DocumentUpload'

function makeFile(name = 'test.txt', content = 'hello') {
  return new File([content], name, { type: 'text/plain' })
}

describe('DocumentUpload', () => {
  it('renders the file input and upload button', () => {
    render(<DocumentUpload onUpload={vi.fn()} />)
    expect(screen.getByLabelText('File')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
  })

  it('enables the upload button when a file is selected', async () => {
    render(<DocumentUpload onUpload={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('File'), makeFile())
    expect(screen.getByRole('button', { name: 'Upload' })).not.toBeDisabled()
  })

  it('calls onUpload with the selected file', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    render(<DocumentUpload onUpload={onUpload} />)
    const file = makeFile('report.txt')
    await userEvent.upload(screen.getByLabelText('File'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
    expect(onUpload).toHaveBeenCalledWith(file)
  })

  it('shows an error when onUpload rejects', async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error('413 Too Large'))
    render(<DocumentUpload onUpload={onUpload} />)
    await userEvent.upload(screen.getByLabelText('File'), makeFile())
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(screen.getByText('413 Too Large')).toBeInTheDocument())
  })
})
