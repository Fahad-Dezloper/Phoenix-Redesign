import Trade from '@/components/trade/TradeScreen';
export default function MarketPage({ params }: { params: { market: string } }) { return <Trade sym={params.market.toUpperCase()} />; }
