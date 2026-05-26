import type { KeyboardEvent } from 'react'
import { Navbar } from '../components/Navbar/Navbar'
import { ProductCard } from '../components/ProductCard/ProductCard'
import { useCart } from '../components/Cart/CartStore'
import { useRecommend, type GridCols, type SortOption } from '../features/Chatbot/hooks/useRecommend'
import { useSpeech } from '../features/Chatbot/hooks/useSpeech'
import type { RecommendFilters } from '../services/aiService'

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clipRule="evenodd" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5zM6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
    </svg>
  )
}

const GRID_COLS_CLASS: Record<GridCols, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}

const EXAMPLE_QUERIES = [
  'Toys for girls under $20',
  'Educational toys for 3 year olds',
  'Best selling baby gifts',
  'Outdoor toys on sale',
]

function FilterPills({ filters, query }: { filters: RecommendFilters; query: string }) {
  const pills: string[] = []
  if (query) pills.push(`"${query}"`)
  if (filters.category) pills.push(filters.category)
  if (filters.age !== null) pills.push(`Age ${filters.age}`)
  if (filters.price_exact !== null) pills.push(`$${filters.price_exact}`)
  if (filters.price_min !== null) pills.push(`From $${filters.price_min}`)
  if (filters.price_max !== null) pills.push(`Up to $${filters.price_max}`)
  if (filters.price_above !== null) pills.push(`Above $${filters.price_above}`)
  if (filters.price_below !== null) pills.push(`Below $${filters.price_below}`)
  filters.tags.forEach(tag => pills.push(tag))

  if (pills.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-gray-400 uppercase tracking-widest">AI extracted:</span>
      {pills.map(pill => (
        <span key={pill} className="bg-[#F5F5F0] border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
          {pill}
        </span>
      ))}
    </div>
  )
}

function ColButton({ value, current, onClick }: { value: GridCols; current: GridCols; onClick: () => void }) {
  const lines = value === 2 ? 2 : value === 3 ? 3 : 4
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${value} columns`}
      className={`p-1.5 rounded transition-colors ${current === value ? 'bg-[#1A1A1A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <rect key={i} x={i * (14 / lines) + 1} y="1" width={12 / lines - 1} height="14" rx="1" fill="currentColor" />
        ))}
      </svg>
    </button>
  )
}

export function RecommendPage() {
  const { addToCart } = useCart()
  const { query, setQuery, loading, error, result, products, sort, setSort, cols, setCols, search } = useRecommend()
  const { listening, error: speechError, startListening } = useSpeech(text => {
    setQuery(text)
    void search(text)
  })

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void search()
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero / Search section */}
      <div className="bg-[#F5F5F0] border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-14 text-center">
          <div className="flex items-center justify-center gap-2 text-[#D4513A] mb-4">
            <SparkleIcon />
            <span className="text-xs font-semibold tracking-[0.2em] uppercase">AI Product Finder</span>
          </div>

          <h1 className="text-3xl font-semibold text-[#1A1A1A] mb-2 tracking-tight">
            Find exactly what you need
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Describe what you're looking for in plain language
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder='e.g. "toys for girls under $20"'
              disabled={loading}
              className="flex-1 border border-gray-200 bg-white rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors disabled:opacity-50 shadow-sm"
              aria-label="Product search query"
            />
            <button
              type="button"
              onClick={() => void startListening()}
              disabled={loading || listening}
              title={listening ? 'Listening…' : 'Search by voice'}
              className={`px-3 py-3 rounded-lg border transition-colors shadow-sm flex items-center justify-center ${
                listening
                  ? 'bg-[#D4513A] border-[#D4513A] text-white animate-pulse'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-40'
              }`}
              aria-label={listening ? 'Listening for speech' : 'Start voice search'}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              onClick={() => void search()}
              disabled={!query.trim() || loading}
              className="bg-[#1A1A1A] hover:bg-[#333] disabled:opacity-40 text-white px-5 py-3 rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2 shadow-sm"
            >
              <SearchIcon />
              Search
            </button>
          </div>
          {listening && (
            <div className="flex items-center justify-center gap-2 mt-3 text-[#D4513A]">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-[#D4513A] rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-[#D4513A] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-[#D4513A] rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-xs font-medium tracking-wide">Listening… speak now</span>
            </div>
          )}
          {speechError && (
            <p role="alert" className="text-xs text-red-500 mt-2">{speechError}</p>
          )}

          {/* Example queries */}
          {!result && !loading && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setQuery(q); }}
                  className="text-xs text-gray-500 border border-gray-200 bg-white hover:border-gray-400 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-full"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results section */}
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
            <span className="flex gap-1.5">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
            <p className="text-sm">AI is finding products for you…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p role="alert" className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => { void search() }}
              className="text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] px-4 py-2 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && result && (
          <>
            {/* Filter pills */}
            <div className="mb-6">
              <FilterPills filters={result.filters} query={result.query} />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-[#1A1A1A]">{products.length}</span> result{products.length !== 1 ? 's' : ''}
              </p>

              <div className="flex items-center gap-4">
                {/* Sort */}
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortOption)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-gray-400 text-gray-600 bg-white"
                  aria-label="Sort products"
                >
                  <option value="relevance">Sort: Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>

                {/* Grid columns */}
                <div className="hidden sm:flex items-center gap-1 border border-gray-200 rounded-md p-0.5">
                  {([2, 3, 4] as GridCols[]).map(n => (
                    <ColButton key={n} value={n} current={cols} onClick={() => setCols(n)} />
                  ))}
                </div>
              </div>
            </div>

            {/* Product grid */}
            {products.length > 0 ? (
              <div className={`grid ${GRID_COLS_CLASS[cols]} gap-x-5 gap-y-10`}>
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-400 text-sm mb-2">No matching products found.</p>
                <p className="text-gray-400 text-xs">Try rephrasing your search or browse the shop.</p>
              </div>
            )}
          </>
        )}

        {/* Empty state before any search */}
        {!loading && !result && !error && (
          <div className="text-center py-20 text-gray-300">
            <SparkleIcon />
            <p className="mt-3 text-sm">Your results will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecommendPage
