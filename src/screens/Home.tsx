import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Gauge, OdometerReadout } from '../components/Gauge'
import { Button, Card, SectionLabel } from '../components/ui'
import { OdometerEntry } from '../components/OdometerEntry'
import { ScheduleRow } from '../components/ScheduleRow'
import { nextUpLine } from '../lib/schedule'
import { confidenceLine, longDate, miles, monthYear } from '../lib/format'
import { dateAtMiles } from '../lib/projection'
import { today } from '../lib/format'

const INTRO_KEY = 'maintenance:intro-seen'

export function Home() {
  const { vehicle, estimate, schedule, appState, setAppState, readings } = useStore()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [previousOdometer, setPreviousOdometer] = useState<number | null>(null)

  // Mirrored to localStorage so the intro does not replay while the profile row loads.
  const localSeen = typeof window !== 'undefined' && localStorage.getItem(INTRO_KEY) === '1'
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  const playIntro = !localSeen && !appState?.has_seen_intro_animation && !isDesktop

  useEffect(() => {
    if (!playIntro) return
    localStorage.setItem(INTRO_KEY, '1')
    const t = setTimeout(() => void setAppState({ has_seen_intro_animation: true }), 1500)
    return () => clearTimeout(t)
  }, [playIntro, setAppState])

  if (!vehicle) return null

  const planEnd = vehicle.plan_end_odometer ?? vehicle.purchase_odometer + 60000
  const pending = schedule.filter((e) => e.status !== 'ok')
  const nextUp = schedule.find((e) => e.status === 'ok') ?? null

  const dangerDate = dateAtMiles(estimate, today(), 60000)

  return (
    <div className="px-4 py-5">
      <div className="mb-6 flex items-center justify-between">
        <p className="t-wordmark">Maintenance</p>
        <Link to="/settings" className="t-support hover:text-text" aria-label="Settings">
          Settings
        </Link>
      </div>

      <div className="enter enter-1 flex flex-col items-center">
        <Gauge
          purchaseOdometer={vehicle.purchase_odometer}
          planEndOdometer={planEnd}
          odometer={estimate.odometer}
          animateFrom={previousOdometer}
          introAnimation={playIntro}
        />
        <div className="mt-3">
          <OdometerReadout miles={estimate.odometer} stagger={playIntro} />
        </div>
        <p className="t-support mt-2 text-center text-text-3" style={{ fontSize: '11px' }}>
          {confidenceLine(estimate.rate.confidence, estimate.rate.readingCount, estimate.rate.dailyRate)}
          {estimate.latest
            ? `. Last confirmed ${miles(estimate.latest.miles)} on ${longDate(estimate.latest.reading_date)}`
            : ''}
        </p>
      </div>

      {estimate.rate.confidence === 'stale' ? (
        <Card className="mt-4">
          <p className="t-body text-text-2">
            The last reading is over a year old, so reminders are paused until you add a current
            number.
          </p>
          <Button className="mt-3 w-full" onClick={() => setSheetOpen(true)}>
            Add reading
          </Button>
        </Card>
      ) : null}

      {dangerDate ? (
        <Card className="mt-5">
          <p className="t-body text-text-2">
            At this rate you reach 60,000 miles around {monthYear(dangerDate)}, which is where the
            known weak spots on this car start.
          </p>
        </Card>
      ) : null}

      <div className="enter enter-2 mt-7">
        <SectionLabel>Coming up</SectionLabel>
        {pending.length ? (
          <div className="flex flex-col gap-2">
            {pending.slice(0, 4).map((entry) => (
              <ScheduleRow key={entry.item.id} entry={entry} />
            ))}
          </div>
        ) : (
          <Card>
            <p className="t-body text-text-2">{nextUpLine(nextUp ?? undefined)}</p>
          </Card>
        )}
        <Link to="/coming-up" className="t-support mt-3 inline-block hover:text-text">
          See the full schedule
        </Link>
      </div>

      <div className="enter enter-3 mt-7 flex gap-2">
        <Button className="flex-1" onClick={() => setSheetOpen(true)}>
          Add reading
        </Button>
        <Button
          variant="secondary"
          aria-label="Log a service"
          onClick={() => navigate('/log')}
          className="px-4"
        >
          Log a service
        </Button>
      </div>

      {sheetOpen ? (
        <div className="sheet-scrim fixed inset-0 z-20 flex items-end bg-black/60" onClick={() => setSheetOpen(false)}>
          <div
            className="sheet-panel w-full rounded-t-[14px] border-t border-line bg-panel px-4 pb-8 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <SectionLabel>Add reading</SectionLabel>
            <OdometerEntry
              onSaved={() => {
                setPreviousOdometer(estimate.odometer)
                setSheetOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}

      {readings.length === 0 ? (
        <p className="t-support mt-6 text-text-3">
          Add a reading whenever you think of it. Each one sharpens every date in the app.
        </p>
      ) : null}
    </div>
  )
}
