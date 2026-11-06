import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import brandConfig from '../../config/brand'
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Badge,
  Alert,
  ToastProvider,
  useToast,
  Tooltip,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Avatar,
  Dropdown,
  Tabs,
  Modal,
  Drawer,
  ConfirmationDialog,
  Table,
  Pagination,
  TableSkeleton,
  Spinner,
  Skeleton,
  EmptyState,
  Breadcrumbs,
  PageHeader,
} from '../../components/ui'
import type { ModalSize, TableColumn, SkeletonAnimation } from '../../components/ui'



interface UIKitPlaygroundProps {
  onNavigateHome?: () => void
}

interface PropertyRecord extends Record<string, unknown> {
  id: number
  title: string
  location: string
  type: string
  rent: string
  score: number
  status: 'active' | 'pending' | 'escrow' | 'terminated'
}

const samplePropertyRecords: PropertyRecord[] = [
  { id: 1, title: 'Kensington Court Residence', location: 'Beach Road, Kozhikode', type: 'Apartment', rent: '₹45,000', score: 95, status: 'active' },
  { id: 2, title: 'Greenwood Luxury Villa', location: 'PT Usha Road, Kozhikode', type: 'Villa', rent: '₹85,000', score: 98, status: 'active' },
  { id: 3, title: 'Downtown Heritage Loft', location: 'Mananchira, Kozhikode', type: 'Studio', rent: '₹32,000', score: 88, status: 'escrow' },
  { id: 4, title: 'CyberPark Executive Suites', location: 'Palazhi, Kozhikode', type: 'Commercial', rent: '₹1,20,000', score: 91, status: 'active' },
  { id: 5, title: 'Malabar Coastal Haven', location: 'Chaliyam, Kozhikode', type: 'Villa', rent: '₹60,000', score: 84, status: 'pending' },
  { id: 6, title: 'Kallai Riverfront Penthouse', location: 'Kallai, Kozhikode', type: 'Apartment', rent: '₹55,000', score: 96, status: 'active' },
  { id: 7, title: 'Emerald Hillside Bungalow', location: 'Chevayur, Kozhikode', type: 'Villa', rent: '₹70,000', score: 89, status: 'escrow' },
  { id: 8, title: 'Orchid Corporate Plaza', location: 'Mavoor Road, Kozhikode', type: 'Commercial', rent: '₹2,50,000', score: 93, status: 'active' },
  { id: 9, title: 'Westhill Seaside Flat', location: 'Westhill, Kozhikode', type: 'Apartment', rent: '₹28,000', score: 79, status: 'pending' },
  { id: 10, title: 'Heritage Commercial Complex', location: 'SM Street, Kozhikode', type: 'Commercial', rent: '₹95,000', score: 92, status: 'terminated' },
  { id: 11, title: 'Palm Meadows Luxury Duplex', location: 'Thondayad, Kozhikode', type: 'Apartment', rent: '₹52,000', score: 94, status: 'active' },
  { id: 12, title: 'Serene Gardens Family Home', location: 'Eranhipalam, Kozhikode', type: 'Villa', rent: '₹48,000', score: 87, status: 'active' },
]

const UIKitPlaygroundContent: React.FC<UIKitPlaygroundProps> = ({ onNavigateHome }) => {
  const navigate = useNavigate()
  const handleNavigateHome = () => {
    if (onNavigateHome) {
      onNavigateHome()
    } else {
      navigate('/')
    }
  }

  const { toast, dismissAll } = useToast()
  const [inputValue, setInputValue] = useState('')
  const [isCopied, setIsCopied] = useState<string | null>(null)
  const [isButtonLoading, setIsButtonLoading] = useState(false)
  const [selectValue, setSelectValue] = useState('apartment')
  const [activePropertyTab, setActivePropertyTab] = useState('residential')
  const [dropdownActionLog, setDropdownActionLog] = useState<string | null>(null)
  const [textareaValue, setTextareaValue] = useState('')
  const [checkboxAgree, setCheckboxAgree] = useState(true)
  const [checkboxMarketing, setCheckboxMarketing] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({})

  // Overlay states (Milestone 4)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSize, setModalSize] = useState<ModalSize>('md')
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false)
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false)
  const [isDefaultConfirmOpen, setIsDefaultConfirmOpen] = useState(false)
  const [isDangerConfirmOpen, setIsDangerConfirmOpen] = useState(false)

  // Table & Pagination states (Milestone 5)
  const [tableCurrentPage, setTableCurrentPage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(5)
  const [selectedTableKeys, setSelectedTableKeys] = useState<(string | number)[]>([1])
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [showEmptyTable, setShowEmptyTable] = useState(false)
  const [standalonePage, setStandalonePage] = useState(4)

  // Loading & Empty state states (Milestone 6)
  const [isSkeletonCardLoading, setIsSkeletonCardLoading] = useState(true)
  const [skeletonAnimation, setSkeletonAnimation] = useState<SkeletonAnimation>('shimmer')


  const displayedData = showEmptyTable
    ? []
    : samplePropertyRecords.slice(
        (tableCurrentPage - 1) * tablePageSize,
        tableCurrentPage * tablePageSize
      )

  const totalTablePages = showEmptyTable
    ? 0
    : Math.ceil(samplePropertyRecords.length / tablePageSize)

  const propertyColumns: TableColumn<PropertyRecord>[] = [
    {
      key: 'property',
      header: 'Property Asset',
      render: (_, record) => (
        <div>
          <span className="font-semibold text-heading block">{record.title}</span>
          <span className="text-xs text-muted block mt-0.5">{record.location}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      accessor: 'type',
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: 'rent',
      render: (val) => <span className="font-bold text-heading">{String(val)}</span>,
    },
    {
      key: 'score',
      header: 'Match Score',
      align: 'center',
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-soft text-brand-deep">
          {String(val)}%
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (_, record) => {
        const config = {
          active: { variant: 'success' as const, label: 'Active Lease' },
          pending: { variant: 'warning' as const, label: 'Audit Pending' },
          escrow: { variant: 'info' as const, label: 'Escrow Active' },
          terminated: { variant: 'danger' as const, label: 'Terminated' },
        }[record.status]
        return <Badge size="sm" variant={config.variant} dot>{config.label}</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, record) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('Property Inspection', `Opening inspection log for ${record.title}`)}
          >
            Inspect
          </Button>
        </div>
      ),
    },
  ]

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text)
    setIsCopied(label)
    setTimeout(() => setIsCopied(null), 1800)
  }

  // Tokens matching the original PropTech brand identity (Morfomec/proptech-mvp)
  const brandColours = [
    { name: 'Primary Brand Green', token: '--color-brand-primary', hex: '#408A71', bgClass: 'bg-[#408A71]', textLight: true },
    { name: 'Light Green Accent', token: '--color-brand-soft', hex: '#A5E0CB', bgClass: 'bg-[#A5E0CB]', textLight: false },
    { name: 'Hover Green', token: '--color-brand-hover', hex: '#34745C', bgClass: 'bg-[#34745C]', textLight: true },
    { name: 'Page Background', token: '--color-background', hex: '#F9FAFB', bgClass: 'bg-[#F9FAFB]', textLight: false },
    { name: 'Surface / Cards', token: '--color-surface', hex: '#FFFFFF', bgClass: 'bg-white', textLight: false },
    { name: 'Primary Text / Headings', token: '--color-heading', hex: '#111827', bgClass: 'bg-[#111827]', textLight: true },
    { name: 'Secondary Text', token: '--color-muted', hex: '#6C7182', bgClass: 'bg-[#6C7182]', textLight: true },
    { name: 'Border', token: '--color-border', hex: '#E5E7EB', bgClass: 'bg-[#E5E7EB]', textLight: false },
  ]

  const statusColours = [
    { name: 'Success', token: '--color-status-success', hex: '#15803D', bgClass: 'bg-[#15803D]' },
    { name: 'Warning', token: '--color-status-warning', hex: '#D97706', bgClass: 'bg-[#D97706]' },
    { name: 'Error', token: '--color-status-error', hex: '#DC2626', bgClass: 'bg-[#DC2626]' },
    { name: 'Information', token: '--color-status-info', hex: '#2563EB', bgClass: 'bg-[#2563EB]' },
  ]

  const radiusTokens = [
    { name: 'xs (4px)', class: 'rounded-xs' },
    { name: 'sm (6px)', class: 'rounded-sm' },
    { name: 'md (8px)', class: 'rounded-md' },
    { name: 'lg (12px)', class: 'rounded-lg' },
    { name: 'xl (16px)', class: 'rounded-xl' },
    { name: '2xl (24px)', class: 'rounded-2xl' },
    { name: 'full', class: 'rounded-full' },
  ]

  const shadowTokens = [
    { name: 'Shadow SM', class: 'shadow-sm' },
    { name: 'Shadow MD', class: 'shadow-md' },
    { name: 'Shadow LG', class: 'shadow-lg' },
    { name: 'Shadow Card', class: 'shadow-card' },
    { name: 'Shadow Card Hover', class: 'shadow-card-hover' },
  ]

  return (
    <div className="min-h-screen bg-background text-muted px-4 py-8 sm:px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation / Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-default gap-4 bg-surface p-6 rounded-2xl shadow-card">
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary text-white p-2.5 rounded-xl shadow-xs">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading tracking-tight mb-0">
                prop<span className="text-brand-primary">tech</span> Design System
              </h1>
              <p className="text-sm text-muted mb-0">
                {brandConfig.tagline} &mdash; Original Green-and-White Identity Preview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-soft text-brand-deep border border-default">
              Route: /dev/ui-kit
            </span>
            <button
              type="button"
              onClick={handleNavigateHome}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-surface text-heading border border-default hover:bg-background transition-colors shadow-xs"
            >
              &larr; Back to Home
            </button>
          </div>
        </header>

        {/* Section 1: Original Brand Colours */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">1. Brand Identity Palette</h2>
            <p className="text-sm text-muted">
              Source of truth: Primary Green (#408A71), Light Green Accent (#A5E0CB), Hover Green (#34745C), Page Background (#F9FAFB), Cards (#FFFFFF), Primary Text (#111827).
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {brandColours.map((item) => (
              <div
                key={item.token}
                onClick={() => copyToClipboard(item.hex, item.name)}
                className="bg-surface rounded-xl border border-default p-3 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
                title="Click to copy HEX"
              >
                <div
                  className={`h-20 w-full rounded-lg ${item.bgClass} border border-default flex items-center justify-center text-xs font-mono font-medium ${
                    item.textLight ? 'text-white' : 'text-heading'
                  }`}
                >
                  {isCopied === item.name ? 'Copied!' : item.hex}
                </div>
                <div className="mt-3">
                  <p className="font-semibold text-heading text-sm mb-0.5 truncate">{item.name}</p>
                  <p className="text-xs font-mono text-muted mb-0">{item.token}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Status Colours */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">2. Status Colours</h2>
            <p className="text-sm text-muted">
              Standardized semantic state feedback colours for badges, alerts, and validations.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statusColours.map((item) => (
              <div
                key={item.token}
                onClick={() => copyToClipboard(item.hex, item.name)}
                className="bg-surface rounded-xl border border-default p-3 shadow-card hover:shadow-card-hover transition-all cursor-pointer"
                title="Click to copy HEX"
              >
                <div className={`h-16 w-full rounded-lg ${item.bgClass} flex items-center justify-center text-white text-xs font-mono font-medium shadow-xs`}>
                  {isCopied === item.name ? 'Copied!' : item.hex}
                </div>
                <div className="mt-3">
                  <p className="font-semibold text-heading text-sm mb-0.5">{item.name}</p>
                  <p className="text-xs font-mono text-muted mb-0">{item.token}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Solid Green Hero Showcase */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">3. Solid Brand Green Hero &amp; Light Green Accent</h2>
            <p className="text-sm text-muted">
              Original solid brand green (#408A71) hero section with crisp white typography and light green (#A5E0CB) accents.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Green Hero Component Preview */}
            <div className="rounded-2xl bg-brand-primary p-6 text-white shadow-md space-y-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white">
                Solid Green Hero Language
              </span>
              <h3 className="text-2xl font-bold text-white mb-1">
                Discover Your Next <span className="text-brand-soft">Dream Home</span>
              </h3>
              <p className="text-xs text-white/95 leading-relaxed mb-4">
                Solid brand green hero with high-contrast white text, matching the original PropTech website.
              </p>
              <div className="flex gap-2">
                <button type="button" className="px-3.5 py-1.5 rounded-lg bg-white text-[#408A71] text-xs font-semibold shadow-xs hover:bg-gray-50 transition-colors cursor-pointer">
                  Browse Properties
                </button>
                <button type="button" className="px-3.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors cursor-pointer">
                  Learn More
                </button>
              </div>
            </div>

            {/* Pale Sage Highlight Section */}
            <div className="rounded-2xl bg-brand-soft p-6 border border-default shadow-card space-y-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-primary text-white">
                Pale Sage Accent (#DCE8E2)
              </span>
              <h3 className="text-2xl font-bold text-heading mb-1">
                Selected State &amp; Section Accents
              </h3>
              <p className="text-xs text-heading/80 leading-relaxed mb-4">
                Used selectively for subtle feature section backgrounds, active tags, and highlighted card states.
              </p>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface text-brand-primary border border-default shadow-xs">
                  Active Filter
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-default">
                  Default Filter
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Typography Hierarchy */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">4. Typography Hierarchy</h2>
            <p className="text-sm text-muted">
              Inter typography scale with Primary Text headings (#111827) and muted secondary body (#6C7182).
            </p>
          </div>
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div className="border-b border-default pb-4">
              <h1 className="text-4xl font-bold text-heading mb-1">Heading 1 &mdash; 36px / 2.25rem</h1>
              <span className="text-xs font-mono text-muted">Class: text-4xl font-bold | Color: #1A1D2D</span>
            </div>
            <div className="border-b border-default pb-4">
              <h2 className="text-3xl font-bold text-heading mb-1">Heading 2 &mdash; 30px / 1.875rem</h2>
              <span className="text-xs font-mono text-muted">Class: text-3xl font-bold | Color: #1A1D2D</span>
            </div>
            <div className="border-b border-default pb-4">
              <h3 className="text-2xl font-semibold text-heading mb-1">Heading 3 &mdash; 24px / 1.5rem</h3>
              <span className="text-xs font-mono text-muted">Class: text-2xl font-semibold | Color: #1A1D2D</span>
            </div>
            <div>
              <p className="text-base text-muted leading-relaxed mb-2">
                Body text (16px / 1rem &bull; #6C7182): The {brandConfig.name} platform provides an intuitive, high-confidence property rental and management experience with verified property assets and automated lease executions.
              </p>
              <p className="text-sm text-muted mb-0">
                Small text (14px / 0.875rem): Standard secondary body and metadata text for descriptions and form labels.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Reusable Button Library */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">5. Foundational Component: Button</h2>
            <p className="text-sm text-muted">
              Built with primary brand green (#408A71), hover green (#34745C), focus rings, 5 variants, 3 sizes, loading and disabled states.
            </p>
          </div>
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            {/* Variants */}
            <div>
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Variants (High Contrast)</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger Button</Button>
              </div>
            </div>

            {/* Disabled States */}
            <div className="pt-4 border-t border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Disabled States (Legible &amp; Distinct)</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled variant="primary">Disabled Primary</Button>
                <Button disabled variant="secondary">Disabled Secondary</Button>
                <Button disabled variant="outline">Disabled Outline</Button>
                <Button disabled variant="ghost">Disabled Ghost</Button>
                <Button disabled variant="danger">Disabled Danger</Button>
              </div>
            </div>

            {/* Sizes */}
            <div className="pt-4 border-t border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Sizes (Vertically &amp; Horizontally Centred)</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small (sm)</Button>
                <Button size="md">Medium (md)</Button>
                <Button size="lg">Large (lg)</Button>
              </div>
            </div>

            {/* States & Icons */}
            <div className="pt-4 border-t border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">States &amp; Centred Icons</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  isLoading={isButtonLoading}
                  loadingText="Processing..."
                  onClick={() => setIsButtonLoading(true)}
                >
                  {isButtonLoading ? 'Loading' : 'Click to Load'}
                </Button>
                {isButtonLoading && (
                  <Button variant="secondary" size="sm" onClick={() => setIsButtonLoading(false)}>
                    Reset Loading
                  </Button>
                )}
                <Button
                  variant="primary"
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Add Property
                </Button>
                <Button
                  variant="outline"
                  rightIcon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  }
                >
                  Next Step
                </Button>
              </div>
            </div>

            {/* Full Width */}
            <div className="pt-4 border-t border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Full Width Button</p>
              <div className="max-w-md">
                <Button fullWidth variant="primary">
                  Full Width Primary Action
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Reusable Form Controls Library */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">6. Foundational Components: Form Controls</h2>
            <p className="text-sm text-muted">
              Input, Textarea, Select, and Checkbox with accessible label association, error messages, hints, and states.
            </p>
          </div>

          {/* 6.1 Input Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">Input Component</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Standard Input (Placeholder)"
                placeholder="e.g. Greenwood Apartments"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                hint="Accessible helper text below the field"
              />

              <Input
                label="Input with Entered Text"
                defaultValue="Greenwood Luxury Heights, Apt 4B"
                hint="Shows dark, readable text (#111827) when active"
              />

              <Input
                label="With Leading Element"
                placeholder="2,850"
                defaultValue="2,850"
                leftElement={<span className="font-semibold text-brand-primary">₹</span>}
                hint="Monthly rental amount in INR"
              />

              <Input
                label="Required Input"
                placeholder="tenant@example.com"
                type="email"
                required
                hint="We will send lease agreements here"
              />

              <Input
                label="Input with Error State"
                defaultValue="invalid-deposit-code"
                error="Please enter a valid 8-digit escrow deposit reference."
              />

              <Input
                label="Disabled State (Legible)"
                defaultValue="PROP-2024-LE-001"
                disabled
                hint="Immutable property identification reference"
              />
            </div>
          </div>

          {/* 6.2 Textarea Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">Textarea Component</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Textarea
                label="Property Description"
                placeholder="Describe key features, amenities, transit proximity and lease terms..."
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                rows={4}
                hint="Detailed descriptions improve tenant compatibility score"
              />

              <div className="space-y-4">
                <Textarea
                  label="Special Terms & Conditions (Error State)"
                  rows={2}
                  resize="none"
                  defaultValue="Short term 1 month only"
                  error="Minimum tenancy period permitted on this platform is 6 months."
                />

                <Textarea
                  label="Archived Lease Notes (Disabled)"
                  rows={2}
                  disabled
                  defaultValue="Security deposit of ₹45,000 held in audited escrow account."
                />
              </div>
            </div>
          </div>

          {/* 6.3 Select Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">Select Component</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Select
                label="Property Type"
                placeholder="Choose property category..."
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
                options={[
                  { label: 'Residential Apartment', value: 'apartment' },
                  { label: 'Independent Villa', value: 'villa' },
                  { label: 'Commercial Office Space', value: 'office' },
                  { label: 'Retail Shop', value: 'shop' },
                  { label: 'Warehouse / Storage', value: 'warehouse', disabled: true },
                ]}
                hint="Determines lease agreement template"
              />

              <Select
                label="Lease Duration"
                required
                defaultValue="12"
                options={[
                  { label: '6 Months', value: '6' },
                  { label: '12 Months (Standard)', value: '12' },
                  { label: '24 Months', value: '24' },
                  { label: '36 Months', value: '36' },
                ]}
                hint="Standard renewable tenancy period"
              />

              <Select
                label="Payment Method (Error State)"
                defaultValue=""
                placeholder="Select payment method..."
                options={[
                  { label: 'Direct Escrow Debit', value: 'escrow' },
                  { label: 'UPI / Net Banking', value: 'upi' },
                ]}
                error="Please select a verified disbursement method."
              />

              <Select
                label="Zoning District (Disabled)"
                defaultValue="kozhikode"
                disabled
                options={[
                  { label: 'Kozhikode Municipal Ward 12', value: 'kozhikode' },
                ]}
                hint="Designated civic licensing body"
              />
            </div>
          </div>

          {/* 6.4 Checkbox Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">Checkbox Component</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Checkbox
                  label="Accept Digital Tenancy Agreement"
                  description="I consent to the legally binding digital lease execution and automatic security escrow hold."
                  checked={checkboxAgree}
                  onChange={(e) => setCheckboxAgree(e.target.checked)}
                />

                <Checkbox
                  label="Tenant Verification Notifications"
                  description="Receive SMS and email alerts whenever compatibility reports or background checks are verified."
                  checked={checkboxMarketing}
                  onChange={(e) => setCheckboxMarketing(e.target.checked)}
                />

                <Checkbox
                  label="Multi-Unit Building Master Lease"
                  description="Indeterminate state indicating some sub-units have executed digital leases."
                  indeterminate
                  defaultChecked
                />
              </div>

              <div className="space-y-4">
                <Checkbox
                  label="Identity Verified (Immutable)"
                  description="This check was verified through Aadhaar/KYC and cannot be modified."
                  disabled
                  defaultChecked
                />

                <Checkbox
                  label="Commercial Sub-Leasing Permitted"
                  description="Disabled unchecked state for properties strictly zoned residential."
                  disabled
                />

                <Checkbox
                  label="Mandatory Escrow Terms"
                  description="You must confirm acknowledgement of escrow dispute resolution."
                  error="You must agree to the escrow arbitration terms to proceed."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: White Property Cards */}
        {/* Section 7: Structural Components (Milestone 3) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">7. Structural Components: Card, Avatar, Dropdown &amp; Tabs</h2>
            <p className="text-sm text-muted">
              Milestone 3 reusable layout and structural components adhering strictly to the PropTech design system.
            </p>
          </div>

          {/* 7.1 Card Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">1. Card Component</h3>
            <p className="text-xs text-muted">Modular container with CardHeader, CardTitle, CardDescription, CardContent, CardFooter, padding scales and visual variants.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Default Card */}
              <Card variant="default">
                <CardHeader>
                  <CardTitle>Standard Default Card</CardTitle>
                  <CardDescription>White surface with subtle border and restrained elevation.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted leading-relaxed">
                    Default card configuration suitable for forms, data summaries, and general layout panels.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="outline">Learn More</Button>
                </CardFooter>
              </Card>

              {/* Accent Card */}
              <Card variant="accent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Brand Accent Card</CardTitle>
                    <Badge variant="success" dot size="sm">Active</Badge>
                  </div>
                  <CardDescription>Features a solid brand-green left border accent (#408A71).</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted leading-relaxed">
                    Ideal for highlighted states, priority alerts, or tenant compatibility summaries.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="primary">Proceed</Button>
                </CardFooter>
              </Card>

              {/* Interactive Elevated Card */}
              <Card variant="elevated" interactive>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Interactive Card</CardTitle>
                    <span className="text-xs font-mono text-brand-primary">Hover me</span>
                  </div>
                  <CardDescription>Hover elevation with smooth transition and cursor pointer.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted leading-relaxed">
                    Optimized for clickable listing cards, quick-action tiles, and tenant profiles.
                  </p>
                </CardContent>
                <CardFooter>
                  <span className="text-xs font-medium text-brand-primary">Click to inspect &rarr;</span>
                </CardFooter>
              </Card>
            </div>
          </div>

          {/* 7.2 Avatar Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">2. Avatar Component</h3>
            <p className="text-xs text-muted">Configurable sizes (sm, md, lg, xl), image fallback with initials calculation, and online status indicators.</p>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Sizes with Status Indicators</p>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Avatar
                      size="sm"
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                      name="Amina Khan"
                      status="online"
                    />
                    <span className="text-xs text-muted">Small (sm)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar
                      size="md"
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
                      name="Vikram Seth"
                      status="busy"
                    />
                    <span className="text-xs text-muted">Medium (md)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar
                      size="lg"
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
                      name="Priya Nair"
                      status="away"
                    />
                    <span className="text-xs text-muted">Large (lg)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar
                      size="xl"
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
                      name="Arun Kumar"
                      status="offline"
                    />
                    <span className="text-xs text-muted">Extra Large (xl)</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-default">
                <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Initials Fallback (When Image Fails or is Absent)</p>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name="Rahul Sharma" size="md" status="online" />
                  <Avatar name="David Miller" size="md" status="busy" />
                  <Avatar name="Sujata Patel" size="md" status="away" />
                  <Avatar name="Kozhikode Realty" size="md" status="offline" />
                  <Avatar fallback="ADMIN" size="md" />
                </div>
              </div>
            </div>
          </div>

          {/* 7.3 Dropdown Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-heading">3. Dropdown Component</h3>
                <p className="text-xs text-muted">Accessible dropdown menu with click-outside listener, Escape key, keyboard arrows, icons, and shortcuts.</p>
              </div>
              {dropdownActionLog && (
                <span className="text-xs text-brand-primary font-medium bg-brand-soft px-3 py-1 rounded-full border border-brand-primary/20">
                  Last action: {dropdownActionLog}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              {/* User Profile Dropdown */}
              <Dropdown
                placement="bottom-left"
                trigger={
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-default bg-surface hover:bg-background transition-colors shadow-xs">
                    <Avatar name="Demo User" size="sm" status="online" />
                    <span className="text-xs font-medium text-heading">Demo User</span>
                    <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                }
                items={[
                  {
                    label: 'Tenant Profile',
                    shortcut: '⇧P',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ),
                    onClick: () => setDropdownActionLog('Navigated to Tenant Profile'),
                  },
                  {
                    label: 'Lease Agreements',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ),
                    onClick: () => setDropdownActionLog('Opened Lease Agreements'),
                  },
                  {
                    label: 'Escrow Account',
                    shortcut: '⌘E',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                    onClick: () => setDropdownActionLog('Opened Escrow Account'),
                  },
                  { separator: true },
                  {
                    label: 'Sign Out',
                    danger: true,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    ),
                    onClick: () => setDropdownActionLog('Signed Out'),
                  },
                ]}
              />

              {/* Actions Dropdown */}
              <Dropdown
                placement="bottom-left"
                trigger={
                  <Button size="sm" variant="primary">
                    Manage Property Options
                    <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                }
                items={[
                  {
                    label: 'Export Inspection Report',
                    shortcut: 'CSV',
                    onClick: () => setDropdownActionLog('Exported Inspection CSV'),
                  },
                  {
                    label: 'Schedule Maintenance Review',
                    onClick: () => setDropdownActionLog('Scheduled Review'),
                  },
                  {
                    label: 'Archive Property Listing',
                    disabled: true,
                  },
                  { separator: true },
                  {
                    label: 'Delete Listing',
                    danger: true,
                    onClick: () => setDropdownActionLog('Listing Deleted'),
                  },
                ]}
              />
            </div>
          </div>

          {/* 7.4 Tabs Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">4. Tabs Component</h3>
              <p className="text-xs text-muted">Underline &amp; Pills variants, icons, badges, disabled tab handling, and accessible keyboard arrow navigation.</p>
            </div>

            {/* Underline Variant */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">Underline Variant (Controlled)</p>
              <Tabs
                variant="underline"
                value={activePropertyTab}
                onChange={setActivePropertyTab}
                items={[
                  {
                    id: 'residential',
                    label: 'Residential Properties',
                    badge: <Badge size="sm" variant="success">14 Available</Badge>,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    ),
                    content: (
                      <div className="p-4 bg-background rounded-xl border border-default text-xs text-muted space-y-1">
                        <p className="font-semibold text-heading text-sm">Residential Listings Panel</p>
                        <p>Browse verified luxury apartments, contemporary villas, and independent flats across Kozhikode and Kerala.</p>
                      </div>
                    ),
                  },
                  {
                    id: 'commercial',
                    label: 'Commercial Spaces',
                    badge: <Badge size="sm" variant="info">6 Available</Badge>,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    ),
                    content: (
                      <div className="p-4 bg-background rounded-xl border border-default text-xs text-muted space-y-1">
                        <p className="font-semibold text-heading text-sm">Commercial Listings Panel</p>
                        <p>Prime IT hubs, retail shops, and corporate office parks ready for long-term commercial lease execution.</p>
                      </div>
                    ),
                  },
                  {
                    id: 'archived',
                    label: 'Archived Contracts',
                    disabled: true,
                    content: <p>No access to archived records.</p>,
                  },
                ]}
              />
            </div>

            {/* Pills Variant */}
            <div className="space-y-3 pt-3 border-t border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">Pills Variant (Uncontrolled with Default)</p>
              <Tabs
                variant="pills"
                defaultValue="overview"
                items={[
                  {
                    id: 'overview',
                    label: 'Lease Overview',
                    content: (
                      <div className="p-3 bg-surface rounded-xl border border-default text-xs text-muted">
                        Active lease agreement terms, escrow deposit breakdown, and maintenance schedules.
                      </div>
                    ),
                  },
                  {
                    id: 'tenant-score',
                    label: 'Compatibility Report',
                    badge: <Badge size="sm" variant="success">98% Match</Badge>,
                    content: (
                      <div className="p-3 bg-surface rounded-xl border border-default text-xs text-muted">
                        High credit qualification rating, verified employer background, and zero past dispute claims.
                      </div>
                    ),
                  },
                  {
                    id: 'documents',
                    label: 'Audit Trail',
                    content: (
                      <div className="p-3 bg-surface rounded-xl border border-default text-xs text-muted">
                        Immutable blockchain audit records and Aadhaar e-sign timestamps.
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Section 8: Feedback Components (Milestone 2) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">8. Feedback Components: Badge, Alert, Toast &amp; Tooltip</h2>
            <p className="text-sm text-muted">
              Milestone 2 reusable feedback components adhering to PropTech design tokens.
            </p>
          </div>

          {/* 8.1 Badges */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">1. Badge Component</h3>
            <p className="text-xs text-muted">Variants (success, warning, danger, info, neutral), sizes (sm, md), dots and icons.</p>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Variants with Dot Indicators</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <Badge variant="success" dot>Active Lease</Badge>
                  <Badge variant="warning" dot>Inspection Pending</Badge>
                  <Badge variant="danger" dot>Payment Overdue</Badge>
                  <Badge variant="info" dot>Draft Contract</Badge>
                  <Badge variant="neutral" dot>Archived</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Variants with Leading Icons</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <Badge
                    variant="success"
                    icon={
                      <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    }
                  >
                    PropTech Verified
                  </Badge>

                  <Badge
                    variant="warning"
                    icon={
                      <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    }
                  >
                    Dispute Review
                  </Badge>

                  <Badge
                    variant="info"
                    icon={
                      <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  >
                    Escrow Protected
                  </Badge>

                  <Badge
                    variant="danger"
                    icon={
                      <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    }
                  >
                    Eviction Notice
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Sizes (Small vs Medium)</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <Badge size="sm" variant="success" dot>Small (sm)</Badge>
                  <Badge size="md" variant="success" dot>Medium (md)</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* 8.2 Alerts */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-heading">2. Alert Component</h3>
                <p className="text-xs text-muted">Accessible semantic alerts (success, warning, error, info) with title, description &amp; dismissal.</p>
              </div>
              {Object.keys(dismissedAlerts).length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setDismissedAlerts({})}>
                  Reset Dismissed Alerts
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {!dismissedAlerts['success'] && (
                <Alert
                  variant="success"
                  title="Tenancy Lease Executed Successfully"
                  onClose={() => setDismissedAlerts((prev) => ({ ...prev, success: true }))}
                >
                  Both tenant and landlord digital signatures have been cryptographic certified. Security escrow hold is now active.
                </Alert>
              )}

              {!dismissedAlerts['info'] && (
                <Alert
                  variant="info"
                  title="Scheduled Property Inspection"
                  onClose={() => setDismissedAlerts((prev) => ({ ...prev, info: true }))}
                >
                  A routine maintenance review is confirmed for Friday, 10:00 AM IST at PT Usha Road, Kozhikode.
                </Alert>
              )}

              {!dismissedAlerts['warning'] && (
                <Alert
                  variant="warning"
                  title="Tenant Compatibility Review Required"
                  onClose={() => setDismissedAlerts((prev) => ({ ...prev, warning: true }))}
                >
                  Applicant income ratio meets 85% of standard qualification. Manual review of secondary guarantor is recommended.
                </Alert>
              )}

              {!dismissedAlerts['error'] && (
                <Alert
                  variant="error"
                  title="Escrow Account Transaction Declined"
                  onClose={() => setDismissedAlerts((prev) => ({ ...prev, error: true }))}
                >
                  The automated monthly disbursement failed due to bank network limits. Please re-verify your linked UPI mandate.
                </Alert>
              )}
            </div>
          </div>

          {/* 8.3 Toast Notification System */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">3. Toast Notification System (`useToast()`)</h3>
            <p className="text-xs text-muted">
              Auto-dismissing, stackable notifications with duplicate prevention, action callbacks, and timer cleanup.
            </p>

            <div className="flex flex-wrap gap-3 items-center">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  toast.success(
                    'Lease Agreement Created',
                    'Digital tenancy document generated for Kensington Court.',
                    {
                      action: {
                        label: 'View Agreement',
                        onClick: () => alert('Navigating to agreement...'),
                      },
                    }
                  )
                }
              >
                Trigger Success Toast
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  toast.info(
                    'New Property Inquiry',
                    'Dr. Ananya sent a viewing request for Contemporary Sea-View Villa.'
                  )
                }
              >
                Trigger Info Toast
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.warning(
                    'Guarantor Verification Pending',
                    'Verification document requires biometric Aadhaar sign-off.'
                  )
                }
              >
                Trigger Warning Toast
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  toast.error(
                    'Escrow Debit Failed',
                    'Could not complete monthly rental transfer from primary account.'
                  )
                }
              >
                Trigger Error Toast
              </Button>

              <Button variant="ghost" size="sm" onClick={() => dismissAll()}>
                Dismiss All Toasts
              </Button>
            </div>
          </div>

          {/* 8.4 Tooltip Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <h3 className="text-base font-bold text-heading">4. Tooltip Component</h3>
            <p className="text-xs text-muted">
              Zero-dependency, accessible tooltips triggered via hover or keyboard focus, with 4 directional placements.
            </p>

            <div className="flex flex-wrap gap-6 items-center pt-2">
              <Tooltip content="Tooltip positioned on top" placement="top">
                <Button size="sm" variant="secondary">Hover: Top</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on bottom" placement="bottom">
                <Button size="sm" variant="secondary">Hover: Bottom</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on left" placement="left">
                <Button size="sm" variant="secondary">Hover: Left</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on right" placement="right">
                <Button size="sm" variant="secondary">Hover: Right</Button>
              </Tooltip>

              <Tooltip content="This tooltip will not show" disabled>
                <Button size="sm" variant="ghost">Disabled Tooltip</Button>
              </Tooltip>
            </div>
          </div>
        </section>

        {/* Section 9: Overlay Components (Milestone 4) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">9. Overlay Components: Modal, Drawer &amp; Confirmation Dialog</h2>
            <p className="text-sm text-muted">
              Milestone 4 accessible overlays with body scroll lock, focus trap, Escape dismissal, and return focus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 9.1 Modal Dialogs */}
            <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-heading">1. Modal Dialog</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Accessible centered dialog with sizes (sm, md, lg, xl), focus trapping, backdrop click and Escape handling.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setModalSize('md')
                      setIsModalOpen(true)
                    }}
                  >
                    Open Modal (md)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setModalSize('sm')
                      setIsModalOpen(true)
                    }}
                  >
                    Small (sm)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setModalSize('lg')
                      setIsModalOpen(true)
                    }}
                  >
                    Large (lg)
                  </Button>
                </div>
              </div>
            </div>

            {/* 9.2 Slide-in Drawers */}
            <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-heading">2. Slide-in Drawer</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Slide-in panels with left and right placement, scroll lock, responsive width, and footer actions.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsRightDrawerOpen(true)}
                  >
                    Open Right Drawer &rarr;
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsLeftDrawerOpen(true)}
                  >
                    &larr; Open Left Drawer
                  </Button>
                </div>
              </div>
            </div>

            {/* 9.3 Confirmation Dialogs */}
            <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-heading">3. Confirmation Dialog</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Specialized dialogs for default and destructive actions with async loading state support.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsDefaultConfirmOpen(true)}
                  >
                    Escrow Release (Async)
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setIsDangerConfirmOpen(true)}
                  >
                    Terminate Lease (Danger)
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Demo Instance */}
          <Modal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            size={modalSize}
            title="Create Verified Property Listing"
            description="Enter official registry details and escrow payment options for this listing."
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsModalOpen(false)
                    toast.success('Listing Created', 'Property listing published successfully.')
                  }}
                >
                  Publish Property
                </Button>
              </>
            }
          >
            <div className="space-y-4 py-1">
              <Input
                label="Property Title"
                placeholder="e.g. Modern Luxury Villa at PT Usha Road"
                defaultValue="Modern Luxury Villa at PT Usha Road"
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Monthly Rent (₹)"
                  placeholder="45,000"
                  defaultValue="45,000"
                  leftElement={<span className="text-brand-primary font-bold">₹</span>}
                  required
                />
                <Select
                  label="Listing Type"
                  defaultValue="residential"
                  options={[
                    { label: 'Residential Lease', value: 'residential' },
                    { label: 'Commercial Space', value: 'commercial' },
                    { label: 'Short Stay', value: 'short-stay' },
                  ]}
                />
              </div>

              <Textarea
                label="Property Overview & Amenities"
                placeholder="Detail high-speed transit, solar power, security..."
                rows={3}
                defaultValue="3 Beds, 2 Baths, 1,200 sqft with automated water heater and 24/7 security."
              />

              <div className="pt-2">
                <Checkbox
                  label="Automated Security Escrow Protection"
                  description="Tenant security deposit will be held in multi-signature escrow."
                  defaultChecked
                />
              </div>
            </div>
          </Modal>

          {/* Right Drawer Demo Instance */}
          <Drawer
            open={isRightDrawerOpen}
            onClose={() => setIsRightDrawerOpen(false)}
            placement="right"
            size="md"
            title="Property Audit Dossier"
            description="Full biometric verification and compliance log for Asset #PR-2024-KOZ."
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setIsRightDrawerOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsRightDrawerOpen(false)
                    toast.success('Dossier Downloaded', 'Official PDF audit certificate generated.')
                  }}
                >
                  Download Certified PDF
                </Button>
              </>
            }
          >
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-background border border-default">
                <Avatar name="Rahul Sharma" size="lg" status="online" />
                <div>
                  <h4 className="text-sm font-bold text-heading">Rahul Sharma</h4>
                  <p className="text-xs text-muted">Primary Registered Property Owner</p>
                  <div className="mt-1">
                    <Badge variant="success" dot size="sm">Aadhaar Verified</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-heading uppercase tracking-wider">Verification Milestones</h5>
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-surface rounded-xl border border-default flex items-center justify-between">
                    <span>Title Deed Registry Encumbrance</span>
                    <Badge variant="success">Clear Title</Badge>
                  </div>
                  <div className="p-3 bg-surface rounded-xl border border-default flex items-center justify-between">
                    <span>Municipality Property Tax</span>
                    <Badge variant="info">Paid 2024</Badge>
                  </div>
                  <div className="p-3 bg-surface rounded-xl border border-default flex items-center justify-between">
                    <span>Fire Safety &amp; Structural Audit</span>
                    <Badge variant="warning">Inspection Scheduled</Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-brand-soft border border-brand-primary/20 space-y-2">
                <h5 className="text-xs font-bold text-brand-deep">Escrow Assurance Score: 98%</h5>
                <p className="text-xs text-heading/80 leading-relaxed">
                  This asset qualifies for fast-track 24h digital tenancy execution with automated security escrow release.
                </p>
              </div>
            </div>
          </Drawer>

          {/* Left Drawer Demo Instance */}
          <Drawer
            open={isLeftDrawerOpen}
            onClose={() => setIsLeftDrawerOpen(false)}
            placement="left"
            size="sm"
            title="Navigation &amp; Filters"
            description="Filter active properties across Kozhikode districts."
            footer={
              <Button fullWidth variant="primary" size="sm" onClick={() => setIsLeftDrawerOpen(false)}>
                Apply Active Filters
              </Button>
            }
          >
            <div className="space-y-4">
              <Select
                label="District / Location"
                defaultValue="mananchira"
                options={[
                  { label: 'Mananchira Square', value: 'mananchira' },
                  { label: 'PT Usha Road', value: 'pt-usha' },
                  { label: 'Beach Road', value: 'beach-road' },
                  { label: 'Kallai', value: 'kallai' },
                ]}
              />

              <Input
                label="Max Monthly Rent (₹)"
                defaultValue="50,000"
                placeholder="50,000"
              />

              <div className="space-y-2 pt-2">
                <Checkbox label="Furnished Properties Only" defaultChecked />
                <Checkbox label="Pet Friendly" />
                <Checkbox label="Zero Brokerage Only" defaultChecked />
              </div>
            </div>
          </Drawer>

          {/* Default Confirmation Dialog Demo Instance (Async Simulation) */}
          <ConfirmationDialog
            open={isDefaultConfirmOpen}
            onClose={() => setIsDefaultConfirmOpen(false)}
            variant="default"
            title="Release Security Deposit Escrow?"
            description="This will execute an automated bank wire of ₹45,000 from the escrow reserve to the verified landlord account. This action cannot be reversed."
            confirmText="Authorize Release"
            cancelText="Keep in Escrow"
            onConfirm={async () => {
              // Simulate async network request
              await new Promise((resolve) => setTimeout(resolve, 1200))
              toast.success('Escrow Released', '₹45,000 disbursed to landlord account.')
            }}
          />

          {/* Danger Confirmation Dialog Demo Instance */}
          <ConfirmationDialog
            open={isDangerConfirmOpen}
            onClose={() => setIsDangerConfirmOpen(false)}
            variant="danger"
            title="Terminate Digital Tenancy Contract?"
            description="Are you sure you want to terminate this active lease agreement for Kensington Court? Both parties will receive formal legal notification and the dispute arbitration protocol will initiate."
            confirmText="Yes, Terminate Tenancy"
            cancelText="Nevermind"
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              toast.error('Tenancy Terminated', 'Notice served to tenant and landlord.')
            }}
          />
        </section>

        {/* Section 10: Data Display & Navigation (Milestone 5) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">
              10. Data Display &amp; Navigation: Table, Pagination &amp; Table Skeleton
            </h2>
            <p className="text-sm text-muted">
              Milestone 5 reusable, data-driven Table with custom cell renders, row selection, responsive horizontal scrolling, standalone Pagination and animated Table Skeleton.
            </p>
          </div>

          {/* 10.1 Interactive Property Records Table with Pagination */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-heading">1. Interactive Property Records Table</h3>
                <p className="text-xs text-muted mt-0.5">
                  Demonstrating custom cells, status badges, row click callbacks, row selection checkboxes, and connected pagination.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={isTableLoading ? 'primary' : 'outline'}
                  onClick={() => setIsTableLoading(!isTableLoading)}
                >
                  {isTableLoading ? 'Disable Loading Skeleton' : 'Simulate Loading State'}
                </Button>

                <Button
                  size="sm"
                  variant={showEmptyTable ? 'primary' : 'outline'}
                  onClick={() => setShowEmptyTable(!showEmptyTable)}
                >
                  {showEmptyTable ? 'Restore Sample Records' : 'Simulate Empty State'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selectedTableKeys.length === 0}
                  onClick={() => setSelectedTableKeys([])}
                >
                  Clear Selection ({selectedTableKeys.length})
                </Button>
              </div>
            </div>

            {/* Selection notification bar */}
            {selectedTableKeys.length > 0 && (
              <div className="p-3 bg-brand-soft/30 border border-brand-primary/20 rounded-xl flex items-center justify-between text-xs text-brand-deep animate-in fade-in-0 duration-150">
                <div className="flex items-center gap-2 font-medium">
                  <Badge variant="success" size="sm">{selectedTableKeys.length} Selected</Badge>
                  <span>Property records marked for batch lease compliance audit.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.success(
                      'Batch Audit Queued',
                      `Queued ${selectedTableKeys.length} property record(s) for verification.`
                    )
                  }
                >
                  Batch Audit
                </Button>
              </div>
            )}

            {/* Table Component Instance */}
            <Table
              columns={propertyColumns}
              data={displayedData}
              rowKey="id"
              loading={isTableLoading}
              loadingRows={5}
              hoverable
              onRowClick={(rec) =>
                toast.info('Row Clicked', `Inspecting property details for ${rec.title}`)
              }
              rowSelection={{
                selectedRowKeys: selectedTableKeys,
                onChange: (keys) => setSelectedTableKeys(keys),
              }}
            />

            {/* Connected Pagination Component */}
            {!isTableLoading && (
              <div className="pt-2">
                <Pagination
                  currentPage={tableCurrentPage}
                  totalPages={totalTablePages}
                  totalItems={showEmptyTable ? 0 : samplePropertyRecords.length}
                  pageSize={tablePageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={(page) => setTableCurrentPage(page)}
                  onPageSizeChange={(newSize) => {
                    setTablePageSize(newSize)
                    setTableCurrentPage(1)
                  }}
                />
              </div>
            )}
          </div>

          {/* 10.2 Standalone Table Skeleton Component Demo */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-4">
            <div>
              <h3 className="text-base font-bold text-heading">2. Standalone Table Skeleton Component</h3>
              <p className="text-xs text-muted mt-0.5">
                Configurable skeleton placeholder (rows, columns, headers) matching the Table component dimensions with subtle pulse animation and reduced-motion support.
              </p>
            </div>

            <TableSkeleton rows={3} columns={5} />
          </div>

          {/* 10.3 Standalone Pagination Variations */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">3. Standalone Pagination Edge Cases</h3>
              <p className="text-xs text-muted mt-0.5">
                Pagination works completely independently with zero records, single-page scenarios, and multi-page ellipses.
              </p>
            </div>

            {/* Variation A: Multi-page with Ellipses */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                Multi-Page with Ellipsis Navigation (Controlled: Page {standalonePage} of 14)
              </p>
              <Pagination
                currentPage={standalonePage}
                totalPages={14}
                totalItems={140}
                pageSize={10}
                onPageChange={(page) => setStandalonePage(page)}
              />
            </div>

            {/* Variation B: Single Page Record */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                Single Page Scenario (Navigation buttons correctly disabled)
              </p>
              <Pagination
                currentPage={1}
                totalPages={1}
                totalItems={7}
                pageSize={10}
                onPageChange={() => {}}
              />
            </div>

            {/* Variation C: Zero Records */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                Zero Records (0 of 0 records, all navigation controls cleanly disabled)
              </p>
              <Pagination
                currentPage={0}
                totalPages={0}
                totalItems={0}
                pageSize={10}
                onPageChange={() => {}}
              />
            </div>
          </div>
        </section>

        {/* Section 11: Loading & Empty State Components (Milestone 6) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">
              11. Loading &amp; Empty State Components: Spinner, Skeleton &amp; Empty State
            </h2>
            <p className="text-sm text-muted">
              Milestone 6 reusable feedback, loading placeholders, and contextual empty-state layouts adhering strictly to the PropTech design system.
            </p>
          </div>

          {/* 11.1 Spinner Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">1. Spinner Component</h3>
              <p className="text-xs text-muted mt-0.5">
                Smooth SVG spinner supporting five standard sizes, multiple brand and neutral color variants, accessible ARIA attributes, and button integration.
              </p>
            </div>

            {/* Spinner Sizes */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">Configurable Sizes</p>
              <div className="flex flex-wrap items-center gap-6 p-4 bg-background rounded-xl border border-default">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="xs" variant="brand" />
                  <span className="text-[11px] font-mono text-muted">xs (14px)</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="sm" variant="brand" />
                  <span className="text-[11px] font-mono text-muted">sm (16px)</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="md" variant="brand" />
                  <span className="text-[11px] font-mono text-muted">md (24px)</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="lg" variant="brand" />
                  <span className="text-[11px] font-mono text-muted">lg (32px)</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="xl" variant="brand" />
                  <span className="text-[11px] font-mono text-muted">xl (48px)</span>
                </div>
              </div>
            </div>

            {/* Spinner Color Variants */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">Color Variants</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-background rounded-xl border border-default flex flex-col items-center gap-2 text-center">
                  <Spinner size="md" variant="brand" />
                  <span className="text-xs font-semibold text-heading">Brand Green</span>
                  <span className="text-[10px] font-mono text-muted">#408A71</span>
                </div>
                <div className="p-4 bg-background rounded-xl border border-default flex flex-col items-center gap-2 text-center">
                  <Spinner size="md" variant="neutral" />
                  <span className="text-xs font-semibold text-heading">Neutral</span>
                  <span className="text-[10px] font-mono text-muted">#6B7280</span>
                </div>
                <div className="p-4 bg-[#1A382A] rounded-xl border border-[#34745C] flex flex-col items-center gap-2 text-center">
                  <Spinner size="md" variant="white" />
                  <span className="text-xs font-semibold text-white">White (Inverted)</span>
                  <span className="text-[10px] font-mono text-gray-300">#FFFFFF</span>
                </div>
                <div className="p-4 bg-background rounded-xl border border-default flex flex-col items-center gap-2 text-center text-amber-600">
                  <Spinner size="md" variant="current" />
                  <span className="text-xs font-semibold text-heading">Current Color</span>
                  <span className="text-[10px] font-mono text-muted">Inherits currentColor</span>
                </div>
              </div>
            </div>

            {/* Spinners with Labels & Inside Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-xl border border-default space-y-3">
                <p className="text-xs font-semibold text-heading uppercase tracking-wider">Visible Loading Labels</p>
                <div className="space-y-3">
                  <div>
                    <Spinner size="sm" variant="brand" showLabel label="Syncing portfolio assets..." />
                  </div>
                  <div>
                    <Spinner size="md" variant="neutral" showLabel label="Analyzing tenant scoring..." />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-background rounded-xl border border-default space-y-3">
                <p className="text-xs font-semibold text-heading uppercase tracking-wider">Inside Button Components</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="sm" leftIcon={<Spinner size="xs" variant="white" />}>
                    Processing Lease...
                  </Button>
                  <Button variant="outline" size="sm" leftIcon={<Spinner size="xs" variant="brand" />}>
                    Verifying Asset
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={<Spinner size="xs" variant="neutral" />}>
                    Syncing Records
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 11.2 Skeleton Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="max-w-xl">
                <h3 className="text-base font-bold text-heading">2. Skeleton Component</h3>
                <p className="text-xs text-muted mt-0.5">
                  Universal placeholder for content loading with shapes (text, circular, rectangular), pulse and shimmer animations, and reduced-motion support.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={skeletonAnimation === 'shimmer' ? 'primary' : 'outline'}
                  onClick={() => setSkeletonAnimation('shimmer')}
                >
                  Shimmer Effect
                </Button>
                <Button
                  size="sm"
                  variant={skeletonAnimation === 'pulse' ? 'primary' : 'outline'}
                  onClick={() => setSkeletonAnimation('pulse')}
                >
                  Pulse Effect
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsSkeletonCardLoading((prev) => !prev)}
                >
                  {isSkeletonCardLoading ? 'Show Loaded Content' : 'Simulate Skeleton'}
                </Button>
              </div>
            </div>

            {/* Basic Shapes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-background rounded-xl border border-default">
              {/* Text Lines */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                  1. Text Lines (Multi-line)
                </span>
                <Skeleton shape="text" lines={3} animation={skeletonAnimation} />
              </div>

              {/* Circular Avatars */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                  2. Circular Avatars
                </span>
                <div className="flex items-center gap-3">
                  <Skeleton shape="circular" width={36} height={36} animation={skeletonAnimation} />
                  <Skeleton shape="circular" width={48} height={48} animation={skeletonAnimation} />
                  <Skeleton shape="circular" width={64} height={64} animation={skeletonAnimation} />
                </div>
              </div>

              {/* Rectangular Media Placeholder */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                  3. Rectangular Placeholder
                </span>
                <Skeleton shape="rectangular" height={72} rounded="lg" animation={skeletonAnimation} />
              </div>
            </div>

            {/* Practical Real-World Loading Layouts */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                Practical PropTech Loading Layouts
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Layout A: Profile / Tenant Loading */}
                <div className="p-5 bg-white rounded-2xl border border-default shadow-card space-y-4">
                  <span className="text-xs font-semibold text-heading block">Profile &amp; Tenant Loading</span>
                  <div className="flex items-center gap-3.5">
                    <Skeleton shape="circular" width={48} height={48} animation={skeletonAnimation} />
                    <div className="space-y-2 flex-1">
                      <Skeleton shape="text" width="65%" height="0.875rem" animation={skeletonAnimation} />
                      <Skeleton shape="text" width="40%" height="0.75rem" animation={skeletonAnimation} />
                    </div>
                  </div>
                  <Skeleton shape="text" lines={2} animation={skeletonAnimation} />
                  <div className="pt-2 flex items-center justify-between">
                    <Skeleton shape="rectangular" width="30%" height={28} rounded="full" animation={skeletonAnimation} />
                    <Skeleton shape="rectangular" width="35%" height={32} rounded="lg" animation={skeletonAnimation} />
                  </div>
                </div>

                {/* Layout B: Property Media Preview */}
                <div className="p-5 bg-white rounded-2xl border border-default shadow-card space-y-4">
                  <span className="text-xs font-semibold text-heading block">Property Image &amp; Details</span>
                  <div className="relative">
                    <Skeleton shape="rectangular" height={140} rounded="xl" animation={skeletonAnimation} />
                    <div className="absolute top-2.5 right-2.5">
                      <Skeleton shape="rectangular" width={60} height={22} rounded="full" animation={skeletonAnimation} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton shape="text" width="80%" height="1rem" animation={skeletonAnimation} />
                    <Skeleton shape="text" width="55%" height="0.75rem" animation={skeletonAnimation} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton shape="text" width="40%" height="1.125rem" animation={skeletonAnimation} />
                    <Skeleton shape="rectangular" width={80} height={32} rounded="lg" animation={skeletonAnimation} />
                  </div>
                </div>

                {/* Layout C: Interactive Live Card Toggle */}
                <div className="p-5 bg-white rounded-2xl border border-default shadow-card">
                  <span className="text-xs font-semibold text-heading block mb-4">
                    Interactive Live Card ({isSkeletonCardLoading ? 'Loading State' : 'Content Loaded'})
                  </span>
                  {isSkeletonCardLoading ? (
                    <div className="space-y-3.5">
                      <Skeleton shape="rectangular" height={130} rounded="xl" animation={skeletonAnimation} />
                      <div className="space-y-2">
                        <Skeleton shape="text" width="75%" height="1rem" animation={skeletonAnimation} />
                        <Skeleton shape="text" width="50%" height="0.75rem" animation={skeletonAnimation} />
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <Skeleton shape="text" width="35%" height="1.25rem" animation={skeletonAnimation} />
                        <Skeleton shape="rectangular" width={90} height={36} rounded="xl" animation={skeletonAnimation} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5 animate-fadeIn">
                      <div className="h-[130px] rounded-xl bg-gradient-to-br from-brand-soft/40 to-brand-primary/20 flex items-center justify-center border border-brand-soft/40">
                        <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                          Kensington Court
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-heading">Kensington Court Penthouse</h4>
                        <p className="text-xs text-muted">Beach Road, Kozhikode &bull; 3 BHK Luxury</p>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-heading">₹45,000</span>
                          <span className="text-[10px] text-muted block">/ month</span>
                        </div>
                        <Button size="sm" variant="primary">
                          View Asset
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 11.3 Empty State Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">3. Empty State Component</h3>
              <p className="text-xs text-muted mt-0.5">
                Purpose-built empty states for zero-data conditions across real estate contexts, featuring contextual illustrations, titles, descriptive helper copy, and primary &amp; secondary action triggers.
              </p>
            </div>

            {/* Grid of Contextual Empty States */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Context A: No Properties */}
              <div className="bg-background rounded-2xl border border-default p-6">
                <EmptyState
                  context="property"
                  size="md"
                  title="No properties listed yet"
                  description="Start adding your residential or commercial real estate assets to begin tracking leases, tenants, and monthly escrow cashflows."
                  action={{
                    label: 'Add First Property',
                    onClick: () => toast.success('Property Added', 'Redirecting to new asset listing wizard.'),
                  }}
                  secondaryAction={{
                    label: 'Import CSV Listings',
                    onClick: () => toast.info('Import Listings', 'Bulk property importer opened.'),
                  }}
                />
              </div>

              {/* Context B: Search Results Empty */}
              <div className="bg-background rounded-2xl border border-default p-6">
                <EmptyState
                  context="search"
                  size="md"
                  title="No matching properties found"
                  description="We couldn't find any real estate assets matching your active filter criteria. Try expanding your search location or price range."
                  action={{
                    label: 'Reset Filters',
                    onClick: () => toast.info('Filters Reset', 'Search filters reverted to default parameters.'),
                  }}
                  secondaryAction={{
                    label: 'Browse All Assets',
                    onClick: () => toast.info('Browse Directory', 'Switching to full portfolio overview.'),
                  }}
                />
              </div>

              {/* Context C: No Tenants Found */}
              <div className="bg-background rounded-2xl border border-default p-6">
                <EmptyState
                  context="tenant"
                  size="md"
                  title="No tenant applications"
                  description="There are currently no active tenant applications or lease agreements requiring background audit."
                  action={{
                    label: 'Invite Prospective Tenant',
                    onClick: () => toast.success('Invitation Sent', 'Tenant onboarding invite link generated.'),
                  }}
                />
              </div>

              {/* Context D: No Records Available */}
              <div className="bg-background rounded-2xl border border-default p-6">
                <EmptyState
                  context="record"
                  size="md"
                  title="No transaction records"
                  description="Your rental disbursements, security deposits, and maintenance logs will appear here once initial transactions are settled."
                  action={{
                    label: 'Generate Statement',
                    onClick: () => toast.info('Export Ledger', 'Generating ledger statement PDF.'),
                  }}
                />
              </div>
            </div>

            {/* Size Variations & Bordered State Demo */}
            <div className="space-y-4 pt-2">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                Size Variations &amp; Bordered Container
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Small Compact Widget Empty State */}
                <div className="bg-background rounded-2xl border border-default p-4">
                  <p className="text-[11px] font-mono text-muted mb-2 text-center uppercase tracking-wider">
                    Small Compact (Widget / Sidebar)
                  </p>
                  <EmptyState
                    context="default"
                    size="sm"
                    title="No notifications"
                    description="You are completely caught up with your daily audit tasks."
                  />
                </div>

                {/* Medium Standard */}
                <div className="bg-background rounded-2xl border border-default p-4">
                  <p className="text-[11px] font-mono text-muted mb-2 text-center uppercase tracking-wider">
                    Medium Standard (Card / Modal)
                  </p>
                  <EmptyState
                    context="property"
                    size="md"
                    title="No active leases"
                    description="Assign a tenant to this property unit to generate lease agreements."
                    action={{
                      label: 'Assign Tenant',
                      onClick: () => toast.info('Assign Lease', 'Opening lease assignment modal.'),
                    }}
                  />
                </div>

                {/* Large Bordered Hero State */}
                <div className="bg-background rounded-2xl border border-default p-4">
                  <p className="text-[11px] font-mono text-muted mb-2 text-center uppercase tracking-wider">
                    Large Bordered Container
                  </p>
                  <EmptyState
                    context="record"
                    size="lg"
                    bordered
                    title="Empty Escrow Account"
                    description="No pending settlements recorded for this financial cycle."
                    action={{
                      label: 'Deposit Funds',
                      onClick: () => toast.success('Escrow Deposit', 'Opening bank deposit gateway.'),
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 12: Navigation & Structure Components (Milestone 7) */}
        <section className="space-y-6">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">
              12. Navigation &amp; Structure: Breadcrumbs and Page Header
            </h2>
            <p className="text-sm text-muted">
              Milestone 7 reusable navigation landmarks, breadcrumb hierarchies, and flexible, responsive page header layouts adhering strictly to the PropTech design system.
            </p>
          </div>

          {/* 12.1 Breadcrumbs Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">1. Breadcrumbs Component</h3>
              <p className="text-xs text-muted mt-0.5">
                Accessible hierarchical navigation landmark with custom separators, leading icons, non-clickable active states, and truncation for long property titles.
              </p>
            </div>

            {/* Basic Breadcrumbs */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                Basic Breadcrumbs (Default Chevron Separator)
              </span>
              <Breadcrumbs
                items={[
                  {
                    label: 'Portfolio',
                    href: '#portfolio',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Portfolio root')
                    },
                  },
                  {
                    label: 'Residential Assets',
                    href: '#residential',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Residential Assets')
                    },
                  },
                  { label: 'Kozhikode District' },
                ]}
              />
            </div>

            {/* Breadcrumbs with Custom Separator */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                Custom Separator (Slash Divider)
              </span>
              <Breadcrumbs
                separator={<span className="text-gray-400 font-normal">/</span>}
                items={[
                  {
                    label: 'Dashboard',
                    href: '#dashboard',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Dashboard')
                    },
                  },
                  {
                    label: 'Tenants & Leases',
                    href: '#tenants',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Tenants & Leases')
                    },
                  },
                  { label: 'Active Escrow Leases' },
                ]}
              />
            </div>

            {/* Breadcrumbs with Icons */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                Breadcrumbs with Leading Icons
              </span>
              <Breadcrumbs
                items={[
                  {
                    label: 'Home',
                    href: '#home',
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    ),
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Home')
                    },
                  },
                  {
                    label: 'Properties',
                    href: '#properties',
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="9" y1="22" x2="9" y2="2" />
                        <line x1="15" y1="22" x2="15" y2="2" />
                      </svg>
                    ),
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Navigating to Properties directory')
                    },
                  },
                  {
                    label: 'CyberPark Commercial Suites',
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    ),
                  },
                ]}
              />
            </div>

            {/* Truncation on Long Titles */}
            <div className="space-y-2 p-4 bg-background rounded-xl border border-default">
              <span className="text-xs font-semibold text-heading uppercase tracking-wider block">
                Overflow Protection with Maximum Item Width (Truncated Title)
              </span>
              <Breadcrumbs
                maxItemWidth="160px"
                items={[
                  {
                    label: 'Kozhikode Metropolitan Assets',
                    href: '#metro',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Clicked long branch link')
                    },
                  },
                  {
                    label: 'Commercial & Corporate Towers',
                    href: '#towers',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb Click', 'Clicked commercial branch link')
                    },
                  },
                  { label: 'Ultra Luxury Sea-Facing Penthouse Residence Unit 402B' },
                ]}
              />
            </div>
          </div>

          {/* 12.2 Page Header Component */}
          <div className="bg-surface rounded-2xl border border-default p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-heading">2. Page Header Component</h3>
              <p className="text-xs text-muted mt-0.5">
                Standardized top-level screen header with configurable title, description, breadcrumbs, leading icons, action buttons, metadata badges, and responsive wrapping.
              </p>
            </div>

            {/* Variation A: Basic Title & Description */}
            <div className="p-6 bg-white rounded-2xl border border-default shadow-card">
              <PageHeader
                title="Property Portfolio"
                description="Monitor all commercial, residential, and multi-unit assets currently managed within your real estate inventory."
              />
            </div>

            {/* Variation B: Page Header with Breadcrumbs and Action Buttons */}
            <div className="p-6 bg-white rounded-2xl border border-default shadow-card">
              <PageHeader
                breadcrumbs={[
                  {
                    label: 'Dashboard',
                    href: '#dashboard',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb', 'Navigating to Dashboard')
                    },
                  },
                  {
                    label: 'Properties',
                    href: '#properties',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb', 'Navigating to Properties')
                    },
                  },
                  { label: 'Commercial Units' },
                ]}
                title="Commercial Properties"
                description="Manage leases, tenant occupancy, and escrow payment distributions across your commercial asset listings."
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Export CSV', 'Exporting property ledger to CSV format.')}
                    >
                      Export CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => toast.success('New Property', 'Opening asset creation wizard.')}
                    >
                      Add New Property
                    </Button>
                  </>
                }
              />
            </div>

            {/* Variation C: Full Responsive Page Header with Leading Icon, Metadata Badges & Child Tabs */}
            <div className="p-6 bg-white rounded-2xl border border-default shadow-card">
              <PageHeader
                breadcrumbs={[
                  {
                    label: 'Assets',
                    href: '#assets',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb', 'Navigating to Assets root')
                    },
                  },
                  {
                    label: 'Beach Road',
                    href: '#beach-road',
                    onClick: (e) => {
                      e.preventDefault()
                      toast.info('Breadcrumb', 'Navigating to Beach Road sector')
                    },
                  },
                  { label: 'Kensington Court' },
                ]}
                icon={
                  <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                }
                subtitle="Asset Code: PROP-KC-092"
                title="Kensington Court Residence"
                meta={
                  <>
                    <Badge size="sm" variant="success" dot>
                      Active Lease
                    </Badge>
                    <Badge size="sm" variant="neutral">
                      3 BHK Penthouse
                    </Badge>
                    <Badge size="sm" variant="info">
                      Match Score: 95%
                    </Badge>
                    <span className="text-xs text-muted">&bull; Verified on Nov 2026</span>
                  </>
                }
                description="Premium beachfront residential property overlooking Beach Road, Kozhikode. Currently under active multi-tenant escrow management."
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Inspect', 'Opening property inspection checklist.')}
                    >
                      Inspection Report
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toast.info('Share', 'Property summary link copied.')}
                    >
                      Share Asset
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => toast.success('Edit Lease', 'Navigating to lease management.')}
                    >
                      Manage Lease
                    </Button>
                  </>
                }
              >
                {/* Child content: Sub-navigation tabs demonstration */}
                <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-heading uppercase tracking-wider">
                      Quick Filter Views:
                    </span>
                    <Badge size="sm" variant="success">All Units (12)</Badge>
                    <Badge size="sm" variant="neutral">Vacant (2)</Badge>
                    <Badge size="sm" variant="warning">Maintenance (1)</Badge>
                  </div>
                  <span className="text-xs text-muted">
                    Last updated 12 mins ago by Portfolio Admin
                  </span>
                </div>
              </PageHeader>
            </div>
          </div>
        </section>

        {/* Section 13: Geometry & Restrained Shadows */}
        <section className="space-y-4">
          <div className="border-b border-default pb-2">
            <h2 className="text-xl font-bold text-heading mb-1">13. Geometry &amp; Restrained Shadows</h2>
            <p className="text-sm text-muted">
              Centralised border radii and soft elevation tokens.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface rounded-2xl border border-default p-5 shadow-card space-y-4">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Border Radii</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {radiusTokens.map((r) => (
                  <div key={r.name} className="flex flex-col items-center p-3 bg-background rounded-xl border border-default">
                    <div className={`w-12 h-12 bg-brand-soft border-2 border-brand-primary ${r.class} mb-2`} />
                    <span className="text-xs font-mono text-heading font-medium text-center">{r.name}</span>
                    <span className="text-[10px] font-mono text-muted">{r.class}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-default p-5 shadow-card space-y-4">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Restrained Shadows</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shadowTokens.map((s) => (
                  <div key={s.name} className={`p-4 bg-surface rounded-xl border border-default ${s.class} flex flex-col justify-center`}>
                    <span className="text-xs font-bold text-heading">{s.name}</span>
                    <span className="text-[11px] font-mono text-muted">{s.class}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-default flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-2 bg-surface p-6 rounded-2xl shadow-card">
          <span>{brandConfig.name} &copy; {new Date().getFullYear()} &mdash; {brandConfig.tagline}</span>
          <a
            href={brandConfig.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-primary hover:underline font-medium"
          >
            {brandConfig.websiteUrl}
          </a>
        </footer>
      </div>
    </div>
  )
}

export const UIKitPlayground: React.FC<UIKitPlaygroundProps> = (props) => {
  return (
    <ToastProvider placement="top-right">
      <UIKitPlaygroundContent {...props} />
    </ToastProvider>
  )
}

export default UIKitPlayground
