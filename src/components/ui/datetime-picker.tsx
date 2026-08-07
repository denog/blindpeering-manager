import * as React from 'react'
import { CalendarIcon, CheckIcon, ClockIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Local datetime string in `YYYY-MM-DDTHH:mm` form, matching
// `<input type="datetime-local">` so it drops in as a form value.
function parseLocalDateTime(value: string | null | undefined) {
  if (!value) return undefined
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = (timePart ?? '00:00').split(':').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day, hours || 0, minutes || 0)
}

function toLocalDateTimeString(date: Date, time: string) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T${time}`
}

function formatDisplay(date: Date) {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Local date string in `YYYY-MM-DD` form, matching `<input type="date">`.
function parseLocalDate(value: string | null | undefined) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// `HH:mm` time strings at 15-minute intervals, matching `<input type="time">`.
const TIME_SLOTS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, '0')
  const minutes = String((index % 4) * 15).padStart(2, '0')
  return `${hours}:${minutes}`
})

function formatTimeLabel(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hours, minutes)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function TimeList({
  value,
  onSelect,
}: {
  value: string
  onSelect: (time: string) => void
}) {
  const selectedRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <Command defaultValue={formatTimeLabel(value)}>
      <CommandInput placeholder="Search time..." />
      <CommandList>
        <CommandEmpty>No matching time.</CommandEmpty>
        <CommandGroup>
          {TIME_SLOTS.map((time) => (
            <CommandItem
              key={time}
              ref={time === value ? selectedRef : undefined}
              value={formatTimeLabel(time)}
              onSelect={() => onSelect(time)}
            >
              <CheckIcon
                className={cn(time !== value && 'invisible')}
              />
              {formatTimeLabel(time)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

type TriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  'value' | 'onChange' | 'type' | 'variant'
>

interface DatePickerProps extends TriggerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}

function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseLocalDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
          {...props}
        >
          <CalendarIcon />
          {selected
            ? selected.toLocaleDateString(undefined, { dateStyle: 'medium' })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            setOpen(false)
            onChange(date ? toLocalDateString(date) : null)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface TimePickerProps extends TriggerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}

function TimePicker({
  value,
  onChange,
  placeholder = 'Pick a time',
  className,
  ...props
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          {...props}
        >
          <ClockIcon />
          {value ? formatTimeLabel(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0">
        <TimeList
          value={value ?? ''}
          onSelect={(time) => {
            setOpen(false)
            onChange(time)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateTimePickerProps extends TriggerProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}

function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick a date and time',
  className,
  ...props
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseLocalDateTime(value)
  const time = selected
    ? `${String(selected.getHours()).padStart(2, '0')}:${String(
        selected.getMinutes(),
      ).padStart(2, '0')}`
    : '00:00'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
          {...props}
        >
          <CalendarIcon />
          {selected ? formatDisplay(selected) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) {
              onChange(null)
              return
            }
            onChange(toLocalDateTimeString(date, time))
          }}
        />
        <div className="w-40 border-l">
          <TimeList
            value={time}
            onSelect={(newTime) => {
              const base = selected ?? new Date()
              onChange(toLocalDateTimeString(base, newTime))
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker, DatePicker, TimePicker }
