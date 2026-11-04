import React, { useEffect, useState } from 'react'
import brandConfig from './config/brand'
import UIKitPlayground from './pages/dev/UIKitPlayground'

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname
    }
    return '/'
  })

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
    }
  }, [])

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path)
      setCurrentPath(path)
      window.scrollTo(0, 0)
    }
  }

  // Route: /dev/ui-kit (Preserved for design system preview)
  if (currentPath === '/dev/ui-kit') {
    return <UIKitPlayground onNavigateHome={() => navigateTo('/')} />
  }

  // Featured properties data matching original PropTech website
  const properties = [
    {
      id: 1,
      title: 'Modern Luxury Apartment',
      location: 'PT Usha Road, Kozhikode, Kerala',
      price: '₹45,000',
      period: '/mo',
      match: 'MATCH: 95%',
      daysAgo: '1 Days Ago',
      beds: '3 Beds',
      baths: '2 Baths',
      sqft: '1,200 sqft',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 2,
      title: 'Contemporary Sea-View Villa',
      location: 'Beach Road, Kozhikode, Kerala',
      price: '₹40,000',
      period: '/mo',
      match: 'MATCH: 90%',
      daysAgo: '2 Days Ago',
      beds: '4 Beds',
      baths: '3 Baths',
      sqft: '2,400 sqft',
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 3,
      title: 'Downtown Heritage Residence',
      location: 'Mananchira, Kozhikode, Kerala',
      price: '₹35,000',
      period: '/mo',
      match: 'MATCH: 85%',
      daysAgo: '3 Days Ago',
      beds: '2 Beds',
      baths: '2 Baths',
      sqft: '950 sqft',
      image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background text-muted antialiased">
      {/* Navigation matching original PropTech visual reference */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-sage backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('/') }} className="flex items-center gap-2 group">
            <div className="bg-brand-primary text-white p-2 rounded-xl group-hover:bg-brand-hover transition-colors shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building-2">
                <path d="M10 12h4" />
                <path d="M10 8h4" />
                <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-heading">
              prop<span className="text-brand-primary">tech</span>
            </span>
          </a>

          {/* Nav Items */}
          <div className="hidden md:flex items-center gap-8">
            <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('/') }} className="text-sm font-medium transition-colors relative text-brand-primary">
              Home
              <div className="absolute -bottom-[26px] left-0 right-0 h-1 bg-brand-primary rounded-t-full" />
            </a>
            <a href="#properties" className="text-sm font-medium transition-colors text-muted hover:text-heading">
              Properties
            </a>
            <a href="#properties" className="text-sm font-medium transition-colors text-muted hover:text-heading">
              Compatibility Score
            </a>
            <a href="#properties" className="text-sm font-medium transition-colors text-muted hover:text-heading">
              Verification &amp; Trust
            </a>
            <a href="#properties" className="text-sm font-medium transition-colors text-muted hover:text-heading">
              Tenancies
            </a>
            <a href="#properties" className="text-sm font-medium transition-colors text-muted hover:text-heading">
              Product Journey
            </a>
          </div>

          {/* Right Action: Demo User pill only (matching visual reference) */}
          <div className="hidden md:flex items-center gap-4">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-[#111827] hover:text-[#111827] transition-colors bg-white hover:bg-gray-50 px-4 py-2 rounded-full border border-gray-200/80 shadow-xs cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user text-brand-primary">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[#111827]">Demo User</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down text-gray-500">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow pt-20">
        {/* Solid Green Hero Section matching original PropTech visual reference */}
        <section className="relative w-full min-h-[540px] flex items-center justify-center bg-brand-hero overflow-hidden py-20 md:py-24 px-6">
          <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Discover Your Next <span className="text-brand-soft">Dream</span><br />
              <span className="text-brand-soft">Home</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg lg:text-xl text-white mb-10 max-w-2xl mx-auto font-normal leading-relaxed">
              Whether you&apos;re looking to buy, sell, or rent &mdash; explore thousands of properties tailored to your lifestyle.
            </p>

            {/* Rounded Pill Search Bar matching visual reference */}
            <div className="w-full max-w-3xl bg-white rounded-2xl md:rounded-full p-2.5 md:p-2 md:pl-6 flex flex-col md:flex-row items-center shadow-xl text-heading border border-gray-100/80 gap-3 md:gap-0">
              <div className="flex-1 flex items-center px-2 w-full md:w-auto border-b md:border-b-0 md:border-r border-gray-200 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin text-gray-400 mr-3 shrink-0">
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <input
                  type="text"
                  placeholder="Location, neighborhood, or city"
                  className="w-full bg-transparent text-[#111827] outline-none placeholder:text-[#6B7280] text-sm md:text-base font-normal"
                />
              </div>

              <div className="flex-1 flex items-center px-4 w-full md:w-auto py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home text-gray-400 mr-3 shrink-0">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <select className="w-full bg-transparent text-[#111827] outline-none appearance-none cursor-pointer text-sm md:text-base font-normal">
                  <option value="" className="text-[#6B7280] bg-white">Property Type</option>
                  <option value="apartment" className="text-[#111827] bg-white">Apartment</option>
                  <option value="house" className="text-[#111827] bg-white">House</option>
                  <option value="commercial" className="text-[#111827] bg-white">Commercial Shop</option>
                  <option value="land" className="text-[#111827] bg-white">Land</option>
                </select>
              </div>

              <button
                type="button"
                className="w-full md:w-auto bg-brand-primary hover:bg-brand-hover text-white px-7 py-3 md:py-3 rounded-xl md:rounded-full font-medium transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search text-white">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="text-white font-medium">Search</span>
              </button>
            </div>
          </div>
        </section>

        {/* Featured Properties Section matching original PropTech visual reference */}
        <section id="properties" className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-3xl font-bold text-heading mb-2">Featured Properties</h2>
                <p className="text-muted">Hand-picked selections tailored for you.</p>
              </div>
              <a
                href="#properties"
                className="text-brand-primary font-semibold hover:underline hidden md:flex items-center gap-1 transition-all"
              >
                View all listings &rarr;
              </a>
            </div>

            {/* Property Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-surface rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 border border-default group cursor-pointer flex flex-col h-full"
                >
                  {/* Property Image with Badges */}
                  <div className="h-64 w-full bg-gray-200 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute top-4 w-full flex justify-between items-start px-4 z-10">
                      <div className="flex gap-2">
                        <span className="bg-surface/95 backdrop-blur-xs text-brand-primary text-xs font-bold px-3 py-1.5 rounded-full shadow-xs tracking-wide">
                          FOR RENT
                        </span>
                        <span className="bg-brand-soft text-brand-deep text-xs font-bold px-3 py-1.5 rounded-full shadow-xs tracking-wide uppercase">
                          {prop.match}
                        </span>
                      </div>
                      <span className="bg-heading/80 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {prop.daysAgo}
                      </span>
                    </div>

                    <img
                      src={prop.image}
                      alt={prop.title}
                      className="w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>

                  {/* Property Card Body */}
                  <div className="p-6 flex flex-col flex-grow justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-heading mb-2 group-hover:text-brand-primary transition-colors line-clamp-1">
                        {prop.title}
                      </h3>
                      <p className="text-muted text-sm mb-4 flex items-center gap-1.5 line-clamp-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin shrink-0 text-muted">
                          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {prop.location}
                      </p>
                      <div className="text-2xl font-extrabold text-brand-primary mb-4">
                        {prop.price}{' '}
                        <span className="text-sm text-muted font-medium">{prop.period}</span>
                      </div>
                    </div>

                    {/* Specs Footer */}
                    <div className="flex items-center justify-between text-muted text-sm pt-4 border-t border-default">
                      <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building text-brand-primary">
                          <rect width="16" height="20" x="4" y="2" rx="2" />
                          <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                        <span>{prop.beds}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key text-brand-primary">
                          <circle cx="7.5" cy="15.5" r="5.5" />
                          <path d="m21 2-9.6 9.6" />
                        </svg>
                        <span>{prop.baths}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home text-brand-primary">
                          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        </svg>
                        <span>{prop.sqft}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center md:hidden">
              <a
                href="#properties"
                className="inline-block bg-brand-primary text-white px-8 py-3 rounded-full font-semibold shadow-xs transition-all"
              >
                View all listings
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer matching original PropTech visual reference */}
      <footer className="bg-surface border-t border-default pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="flex flex-col gap-6">
              <a href="/" onClick={(e) => { e.preventDefault(); navigateTo('/') }} className="flex items-center gap-2 group w-fit">
                <div className="bg-brand-primary text-white p-2 rounded-xl group-hover:bg-brand-hover transition-colors shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building-2">
                    <path d="M10 12h4" />
                    <path d="M10 8h4" />
                    <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
                    <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
                    <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                  </svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-heading">
                  prop<span className="text-brand-primary">tech</span>
                </span>
              </a>
              <p className="text-muted text-sm leading-relaxed">
                Find your dream home with ease. We provide the best properties at the most affordable prices.
              </p>
              <div className="flex items-center gap-4 text-muted">
                <button
                  type="button"
                  onClick={() => navigateTo('/dev/ui-kit')}
                  className="text-xs font-medium text-brand-primary hover:underline"
                >
                  UI Kit Playground (/dev/ui-kit)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-semibold text-heading mb-2">Quick Links</h3>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Buy Property</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Rent Property</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Sell Property</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Our Agents</a>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-semibold text-heading mb-2">Support</h3>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">FAQ</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Contact Us</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Privacy Policy</a>
              <a className="text-sm text-muted hover:text-brand-primary transition-colors" href="#properties">Terms of Service</a>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-semibold text-heading mb-2">Contact Us</h3>
              <p className="text-sm text-muted">123 Proptech Ave,<br />Suite 100, New York, NY 10001</p>
              <p className="text-sm text-muted">+1 (555) 123-4567</p>
              <p className="text-sm text-muted">hello@proptech.com</p>
            </div>
          </div>

          <div className="pt-8 border-t border-default flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">&copy; {new Date().getFullYear()} {brandConfig.name}. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-muted">
              <span>Theme: <code>src/styles/theme.css</code></span>
              <a href={brandConfig.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-brand-primary transition-colors">
                {brandConfig.websiteUrl}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
