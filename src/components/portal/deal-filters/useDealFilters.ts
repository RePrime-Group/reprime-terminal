'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

export type SortKey =
  | 'name'
  | 'purchase_price'
  | 'cap_rate'
  | 'irr'
  | 'coc'
  | 'equity_required'
  | 'noi';
export type SortDir = 'asc' | 'desc';

export interface DealFilterController {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedTypes: Set<string>;
  toggleType: (pt: string) => void;
  sellerFinancingOnly: boolean;
  setSellerFinancingOnly: (v: boolean) => void;
  priceRange: [number, number];
  setPriceRange: (v: [number, number]) => void;
  irrMin: number;
  setIrrMin: (v: number) => void;
  cocMin: number;
  setCocMin: (v: number) => void;
  sortKey: SortKey | '';
  sortDir: SortDir;
  setSort: (key: SortKey | '', dir?: SortDir) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  propertyTypes: string[];
  priceBounds: [number, number];
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  resultsCount: number;
}

/**
 * Shared search / filter / sort logic for the deal grids (Dashboard,
 * Marketplace, and the curated group tab). Returns a controller for the
 * <DealFilterBar /> plus the filtered (and sorted) list. Behaviour is the
 * same across all three so the bar looks and works identically everywhere.
 */
export function useDealFilters(deals: DealCardData[]): {
  controller: DealFilterController;
  filteredDeals: DealCardData[];
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sellerFinancingOnly, setSellerFinancingOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [irrMin, setIrrMin] = useState<number>(0);
  const [cocMin, setCocMin] = useState<number>(0);
  const [sortKey, setSortKey] = useState<SortKey | ''>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const propertyTypes = useMemo(
    () => [...new Set(deals.map((d) => d.property_type).filter(Boolean))].sort(),
    [deals],
  );
  const priceBounds = useMemo(() => {
    const prices = deals.map((d) => d.purchase_price).filter(Boolean);
    return [Math.min(...prices, 0), Math.max(...prices, 1)] as [number, number];
  }, [deals]);

  useEffect(() => {
    setPriceRange(priceBounds);
  }, [priceBounds]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedTypes.size > 0 ||
    sellerFinancingOnly ||
    priceRange[0] > priceBounds[0] ||
    priceRange[1] < priceBounds[1] ||
    irrMin > 0 ||
    cocMin > 0;

  function clearAllFilters() {
    setSearchQuery('');
    setSelectedTypes(new Set());
    setSellerFinancingOnly(false);
    setPriceRange(priceBounds);
    setIrrMin(0);
    setCocMin(0);
    setSortKey('');
    setSortDir('desc');
  }

  function toggleType(pt: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });
  }

  function setSort(key: SortKey | '', dir: SortDir = 'desc') {
    setSortKey(key);
    if (key) setSortDir(dir);
  }

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q) ||
          d.state.toLowerCase().includes(q) ||
          `${d.city} ${d.state}`.toLowerCase().includes(q),
      );
    }

    if (selectedTypes.size > 0) {
      result = result.filter((d) => selectedTypes.has(d.property_type));
    }

    if (sellerFinancingOnly) {
      result = result.filter((d) => d.seller_financing);
    }

    if (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]) {
      result = result.filter(
        (d) => d.purchase_price >= priceRange[0] && d.purchase_price <= priceRange[1],
      );
    }

    if (irrMin > 0) result = result.filter((d) => d.irr >= irrMin);
    if (cocMin > 0) result = result.filter((d) => d.coc >= cocMin);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [
    deals,
    searchQuery,
    selectedTypes,
    sellerFinancingOnly,
    priceRange,
    priceBounds,
    irrMin,
    cocMin,
    sortKey,
    sortDir,
  ]);

  const controller: DealFilterController = {
    searchQuery,
    setSearchQuery,
    selectedTypes,
    toggleType,
    sellerFinancingOnly,
    setSellerFinancingOnly,
    priceRange,
    setPriceRange,
    irrMin,
    setIrrMin,
    cocMin,
    setCocMin,
    sortKey,
    sortDir,
    setSort,
    filtersOpen,
    setFiltersOpen,
    propertyTypes,
    priceBounds,
    hasActiveFilters,
    clearAllFilters,
    resultsCount: filteredDeals.length,
  };

  return { controller, filteredDeals };
}
