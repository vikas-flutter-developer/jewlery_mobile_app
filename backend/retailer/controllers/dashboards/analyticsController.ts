import { Request, Response } from 'express';
import { mockSales, mockDesigns, mockRates } from '../../../data/mockData.js';
import { isDbConnected } from '../../../lib/serverState.js';




import { Sale, Customer, Inventory, Rate, Karikar } from "../../models/index.js";

// Helper to generate the last 7 days date strings
const getLast7Days = (): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

// Feature 186: Sales trend by category (rings vs necklaces)
export const getSalesByCategory = async (_req: Request, res: Response) => {
  try {
    const dates = getLast7Days();
    const categories = ['Ring', 'Necklace', 'Coin', 'Other'];

    if (!isDbConnected()) {
      // Fallback: synthesize trend from mockSales & mockDesigns
      const trend = categories.map((cat) => ({
        category: cat,
        last7Days: dates.map((date) => {
          let count = 0;
          mockSales.forEach((s: any) => {
            const sDate = s.createdAt.slice(0, 10);
            if (sDate === date) {
              s.items.forEach((item: any) => {
                const name = (item.name || '').toLowerCase();
                let itemCat = 'Other';
                if (name.includes('ring')) itemCat = 'Ring';
                else if (name.includes('necklace') || name.includes('choker') || name.includes('pendant')) itemCat = 'Necklace';
                else if (name.includes('coin')) itemCat = 'Coin';
                
                if (itemCat === cat) count++;
              });
            }
          });
          return { date, sales: count };
        }),
      }));

      return res.json({ success: true, data: trend });
    }

    // When DB is connected, aggregate by item categories from Sale items
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sales = await Sale.find({ createdAt: { $gte: sevenDaysAgo } });

    // Gather unique barcodes
    const barcodes = new Set<string>();
    sales.forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        if (item.barcode) barcodes.add(item.barcode);
      });
    });

    // Fetch corresponding inventory items for type categories
    const inventoryItems = await Inventory.find({ barcode: { $in: Array.from(barcodes) } });
    const barcodeToTypeMap = new Map<string, string>();
    inventoryItems.forEach((inv: any) => {
      if (inv.type) {
        barcodeToTypeMap.set(inv.barcode, inv.type);
      }
    });

    const getCategory = (item: any) => {
      if (item.barcode && barcodeToTypeMap.has(item.barcode)) {
        return barcodeToTypeMap.get(item.barcode)!;
      }
      const name = (item.name || '').toLowerCase();
      if (name.includes('ring')) return 'Ring';
      if (name.includes('necklace') || name.includes('choker') || name.includes('pendant')) return 'Necklace';
      if (name.includes('coin')) return 'Coin';
      return 'Other';
    };

    // Initialize trend structure
    const trendMap: Record<string, Record<string, number>> = {};
    categories.forEach(cat => {
      trendMap[cat] = {};
      dates.forEach(date => {
        trendMap[cat][date] = 0;
      });
    });

    sales.forEach((sale: any) => {
      const dateStr = new Date(sale.createdAt).toISOString().slice(0, 10);
      if (trendMap['Ring'][dateStr] !== undefined) {
        sale.items.forEach((item: any) => {
          const cat = getCategory(item);
          const currentCat = trendMap[cat] ? cat : 'Other';
          trendMap[currentCat][dateStr] = (trendMap[currentCat][dateStr] || 0) + 1;
        });
      }
    });

    const trend = categories.map(category => ({
      category,
      last7Days: dates.map(date => ({
        date,
        sales: trendMap[category][date]
      }))
    }));

    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

// Feature 187: Top selling items report
export const getTopSellingItems = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      // Use mockSales to compute top items with count and revenue
      const itemsStats: Record<string, { count: number; revenue: number }> = {};
      mockSales.forEach((s: any) => s.items.forEach((it: any) => {
        if (!itemsStats[it.name]) {
          itemsStats[it.name] = { count: 0, revenue: 0 };
        }
        itemsStats[it.name].count += 1;
        itemsStats[it.name].revenue += (it.total || 0);
      }));
      const top = Object.keys(itemsStats).map((name) => ({
        name,
        count: itemsStats[name].count,
        revenue: itemsStats[name].revenue
      })).sort((a, b) => b.count - a.count);
      return res.json({ success: true, data: top.slice(0, 20) });
    }

    const pipeline: any[] = [
      { $unwind: '$items' },
      { $group: { _id: '$items.name', sold: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$items.total', 0] } } } },
      { $sort: { sold: -1 } },
      { $limit: 50 },
    ];

    const result = await Sale.aggregate(pipeline);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

// Feature 188: Best customers by purchase value
export const getBestCustomersByValue = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      // Fallback: aggregate from mockSales
      const customers: Record<string, number> = {};
      mockSales.forEach((s: any) => { customers[s.customerName] = (customers[s.customerName] || 0) + (s.total || 0); });
      const list = Object.keys(customers).map((k) => ({ customerName: k, total: customers[k] })).sort((a, b) => b.total - a.total);
      return res.json({ success: true, data: list.slice(0, 20) });
    }

    const pipeline: any[] = [
      { $group: { _id: '$customerName', totalValue: { $sum: { $ifNull: ['$total', 0] } } } },
      { $sort: { totalValue: -1 } },
      { $limit: 50 },
    ];

    const result = await Sale.aggregate(pipeline);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

// Feature 189: Hourly / time-of-day sales heatmap
export const getHourlySalesHeatmap = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      // Create 24-hour buckets based on mockSales timestamps
      const mockHourly = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        sales: 0
      }));
      mockSales.forEach((s: any) => {
        const hour = new Date(s.createdAt).getHours();
        mockHourly[hour].sales += 1;
      });
      return res.json({ success: true, data: mockHourly });
    }

    const pipeline: any[] = [
      {
        $project: {
          hour: { $hour: { $toDate: '$createdAt' } }
        }
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 }
        }
      }
    ];

    const result = await Sale.aggregate(pipeline);

    // Fill the 24 hour buckets
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      sales: 0
    }));
    result.forEach((r: any) => {
      const h = r._id;
      if (h >= 0 && h < 24) {
        hourlyData[h].sales = r.count;
      }
    });

    res.json({ success: true, data: hourlyData });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

// Feature 190: Metal rate vs sales correlation chart
export const getMetalRateCorrelation = async (_req: Request, res: Response) => {
  try {
    const getMetalKey = (purity: string) => {
      const p = (purity || '').toLowerCase();
      if (p.includes('24k')) return 'GOLD_24K';
      if (p.includes('22k')) return 'GOLD_22K';
      if (p.includes('18k')) return 'GOLD_18K';
      if (p.includes('silver') || p.includes('fine')) return 'SILVER';
      return null;
    };

    if (!isDbConnected()) {
      const salesVolume: Record<string, number> = {
        GOLD_24K: 0,
        GOLD_22K: 0,
        GOLD_18K: 0,
        SILVER: 0
      };
      mockSales.forEach((s: any) => {
        s.items.forEach((item: any) => {
          const key = getMetalKey(item.purity);
          if (key && salesVolume[key] !== undefined) {
            salesVolume[key] += 1;
          }
        });
      });
      
      const defaultRates: Record<string, number> = {
        GOLD_24K: 6200,
        GOLD_22K: 5600,
        GOLD_18K: 4600,
        SILVER: 75
      };
      mockRates.forEach(r => {
        defaultRates[r.metal] = r.rate;
      });

      const correlation = Object.keys(defaultRates).map((metal) => ({
        metal,
        rate: defaultRates[metal],
        sales: salesVolume[metal] || 0
      }));
      return res.json({ success: true, data: correlation });
    }

    const rates = await Rate.find({});
    const sales = await Sale.find({});
    
    const salesVolume: Record<string, number> = {
      GOLD_24K: 0,
      GOLD_22K: 0,
      GOLD_18K: 0,
      SILVER: 0
    };
    
    sales.forEach((s: any) => {
      s.items.forEach((item: any) => {
        const key = getMetalKey(item.purity);
        if (key && salesVolume[key] !== undefined) {
          salesVolume[key] += 1;
        }
      });
    });

    const rateMap: Record<string, number> = {
      GOLD_24K: 6200,
      GOLD_22K: 5600,
      GOLD_18K: 4600,
      SILVER: 75
    };
    mockRates.forEach(r => {
      rateMap[r.metal] = r.rate;
    });
    rates.forEach((r: any) => {
      rateMap[r.metal] = r.rate;
    });

    const correlation = Object.keys(rateMap).map(metal => ({
      metal,
      rate: rateMap[metal],
      sales: salesVolume[metal] || 0
    }));

    res.json({ success: true, data: correlation });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

// Feature 191: Karikar efficiency report (on time vs delayed)
export const getKarikarEfficiency = async (_req: Request, res: Response) => {
  try {
    const fallbackSample = { onTime: 82, delayed: 18, totalJobs: 250, averageTurnaroundDays: 2.8 };

    if (!isDbConnected()) {
      return res.json({ success: true, data: fallbackSample });
    }

    const karikars = await Karikar.find({});
    let onTimeCount = 0;
    let delayedCount = 0;
    let totalCompletedJobs = 0;
    let totalTurnaroundMs = 0;

    karikars.forEach((karikar: any) => {
      const cards = karikar.jobCards || [];
      cards.forEach((card: any) => {
        const dueDate = card.dueDate ? new Date(card.dueDate) : null;
        const issuedDate = card.issuedAt ? new Date(card.issuedAt) : null;
        if (!dueDate) return;

        const isReceived = card.status === 'RECEIVED' || !!card.receivedAt;
        const compareDate = isReceived ? new Date(card.receivedAt!) : new Date();

        if (compareDate <= dueDate) {
          onTimeCount++;
        } else {
          delayedCount++;
        }

        if (isReceived && issuedDate && card.receivedAt) {
          totalCompletedJobs++;
          const turnaroundMs = new Date(card.receivedAt).getTime() - issuedDate.getTime();
          totalTurnaroundMs += Math.max(0, turnaroundMs);
        }
      });
    });

    const totalJobs = onTimeCount + delayedCount;
    if (totalJobs === 0) {
      return res.json({ success: true, data: fallbackSample });
    }

    const onTimePercent = Math.round((onTimeCount / totalJobs) * 100);
    const delayedPercent = 100 - onTimePercent;

    const averageTurnaroundDays = totalCompletedJobs > 0
      ? parseFloat((totalTurnaroundMs / (1000 * 60 * 60 * 24) / totalCompletedJobs).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        onTime: onTimePercent,
        delayed: delayedPercent,
        totalJobs,
        averageTurnaroundDays
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error' });
  }
};

export default {};



