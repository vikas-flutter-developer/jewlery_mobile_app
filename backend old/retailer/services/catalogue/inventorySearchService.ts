import { inventoryCatalogueRepository, InventorySearchFilters } from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { normalizeInventoryListItem } from "./catalogueAuditService.js";

export const inventorySearchService = {
  async search(filters: InventorySearchFilters) {
    const result = await inventoryCatalogueRepository.search(filters);
    return {
      ...result,
      items: result.items.map(normalizeInventoryListItem),
    };
  },

  hasSearchParams(filters: InventorySearchFilters) {
    return Boolean(
      filters.q ||
        filters.sku ||
        filters.barcode ||
        filters.rfid ||
        filters.name ||
        filters.vendorId ||
        filters.category ||
        filters.metal ||
        filters.purity ||
        filters.hallmarkNumber ||
        filters.branchId ||
        filters.page ||
        filters.limit
    );
  },

  parseQuery(query: Record<string, unknown>): InventorySearchFilters {
    return {
      q: query.q ? String(query.q) : undefined,
      sku: query.sku ? String(query.sku) : undefined,
      barcode: query.barcode ? String(query.barcode) : undefined,
      rfid: query.rfid ? String(query.rfid) : undefined,
      name: query.name ? String(query.name) : undefined,
      vendorId: query.vendorId ? String(query.vendorId) : undefined,
      category: query.category ? String(query.category) : undefined,
      metal: query.metal ? String(query.metal) : undefined,
      purity: query.purity ? String(query.purity) : undefined,
      hallmarkNumber: query.hallmarkNumber ? String(query.hallmarkNumber) : undefined,
      branchId: query.branchId ? String(query.branchId) : undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    };
  },
};
