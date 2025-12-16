
'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { addSubscriberAction, getSubscribersAction, getGoogleAnalyticsDataAction, getNewsletterFeedbackAction, type AnalyticsDataPoint, type NewsletterFeedbackEntry } from '../../actions';
import { Loader2, PlusCircle, CalendarIcon, Users, Eye } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { getBasePath, withBasePath } from '@/lib/base-path';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, subDays, subWeeks, subMonths, subQuarters, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

type Subscriber = {
  email: string;
  name: string;
  subscribedAt: string | null;
  lastFeedbackScore?: number | null;
  lastFeedbackDate?: string | null;
  lastFeedbackAt?: string | null;
  lastFeedbackComment?: string | null;
};

type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

const chartConfig: ChartConfig = {
  subscribers: {
    label: 'New Subscribers',
    color: 'hsl(var(--primary))',
  },
  cumulative: {
    label: 'Total Subscribers',
    color: 'hsl(var(--chart-2))',
  },
};

const trafficChartConfig: ChartConfig = {
  visitors: {
    label: 'Visitors',
    color: 'hsl(var(--chart-1))',
  },
  pageViews: {
    label: 'Page Views',
    color: 'hsl(var(--chart-3))',
  },
};

const feedbackChartConfig: ChartConfig = {
  avgScore: {
    label: 'Avg Score',
    color: 'hsl(var(--primary))',
  },
  responses: {
    label: 'Responses',
    color: 'hsl(var(--chart-1))',
  },
};

function getDateRangeForTimeRange(timeRange: TimeRange, customRange?: DateRange, dataStartDate?: Date): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);
  
  // If we have a data start date, use it as the minimum start date
  const getAdjustedStart = (calculatedStart: Date) => {
    if (dataStartDate && calculatedStart < dataStartDate) {
      return startOfDay(dataStartDate);
    }
    return calculatedStart;
  };
  
  switch (timeRange) {
    case 'day':
      return { start: getAdjustedStart(startOfDay(subDays(now, 30))), end }; // Last 30 days
    case 'week':
      return { start: getAdjustedStart(startOfWeek(subWeeks(now, 12))), end }; // Last 12 weeks
    case 'month':
      return { start: getAdjustedStart(startOfMonth(subMonths(now, 12))), end }; // Last 12 months
    case 'quarter':
      return { start: getAdjustedStart(startOfQuarter(subQuarters(now, 8))), end }; // Last 8 quarters
    case 'year':
      return { start: getAdjustedStart(startOfYear(subYears(now, 5))), end }; // Last 5 years
    case 'custom':
      if (customRange?.from && customRange?.to) {
        return { start: startOfDay(customRange.from), end: endOfDay(customRange.to) };
      }
      return { start: getAdjustedStart(startOfDay(subDays(now, 30))), end };
    default:
      return { start: getAdjustedStart(startOfDay(subDays(now, 30))), end };
  }
}

function generateChartData(subscribers: Subscriber[], timeRange: TimeRange, dateRange: { start: Date; end: Date }) {
  const subscribersWithDates = subscribers.filter(s => s.subscribedAt);

  // Generate all time periods in range
  const periods: { label: string; start: Date; end: Date }[] = [];
  let current = new Date(dateRange.start);
  
  // Safety limit to prevent infinite loops
  const maxIterations = 1000;
  let iterations = 0;
  
  // Determine granularity for custom range
  const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
  const effectiveTimeRange = timeRange === 'custom' 
    ? (rangeDays <= 31 ? 'day' : rangeDays <= 180 ? 'week' : 'month')
    : timeRange;
  
  while (current <= dateRange.end && iterations < maxIterations) {
    iterations++;
    let periodStart: Date;
    let periodEnd: Date;
    let label: string;
    let nextCurrent: Date;
    
    switch (effectiveTimeRange) {
      case 'day':
        periodStart = startOfDay(current);
        periodEnd = endOfDay(current);
        label = format(current, 'MMM d');
        nextCurrent = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
        break;
      case 'week':
        periodStart = startOfWeek(current);
        periodEnd = endOfWeek(current);
        label = format(periodStart, 'MMM d');
        nextCurrent = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + 7);
        break;
      case 'month':
        periodStart = startOfMonth(current);
        periodEnd = endOfMonth(current);
        label = format(current, 'MMM yyyy');
        nextCurrent = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        break;
      case 'quarter':
        periodStart = startOfQuarter(current);
        periodEnd = endOfQuarter(current);
        const quarter = Math.floor(current.getMonth() / 3) + 1;
        label = `Q${quarter} ${current.getFullYear()}`;
        nextCurrent = new Date(current.getFullYear(), current.getMonth() + 3, 1);
        break;
      case 'year':
        periodStart = startOfYear(current);
        periodEnd = endOfYear(current);
        label = format(current, 'yyyy');
        nextCurrent = new Date(current.getFullYear() + 1, 0, 1);
        break;
      default:
        periodStart = startOfDay(current);
        periodEnd = endOfDay(current);
        label = format(current, 'MMM d');
        nextCurrent = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    }
    
    // Ensure we always advance to prevent infinite loop
    if (nextCurrent.getTime() <= current.getTime()) {
      nextCurrent = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    
    periods.push({ label, start: periodStart, end: periodEnd });
    current = nextCurrent;
  }

  // Count subscribers per period using subscribedAt field
  const data = periods.map(period => {
    const count = subscribersWithDates.filter(s => {
      const subDate = new Date(s.subscribedAt!);
      return subDate >= period.start && subDate <= period.end;
    }).length;
    
    return {
      period: period.label,
      subscribers: count,
    };
  });

  // Add cumulative count
  let cumulative = 0;
  // Count subscribers before the start date
  const subscribersBefore = subscribersWithDates.filter(s => {
    const subDate = new Date(s.subscribedAt!);
    return subDate < dateRange.start;
  }).length;
  cumulative = subscribersBefore;

  return data.map(d => {
    cumulative += d.subscribers;
    return { ...d, cumulative };
  });
}

export default function SubscribersPage() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<NewsletterFeedbackEntry[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  
  // Traffic data state
  const [trafficData, setTrafficData] = useState<AnalyticsDataPoint[]>([]);
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(true);
  const [trafficTimeRange, setTrafficTimeRange] = useState<TimeRange>('month');
  const [trafficCustomDateRange, setTrafficCustomDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    const fetchSubscribers = async () => {
      setIsLoading(true);
      const result = await getSubscribersAction();
      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error fetching subscribers',
          description: result.error,
        });
      } else {
        setSubscribers(result as Subscriber[]);
      }
      setIsLoading(false);
    };
    fetchSubscribers();
  }, [toast]);

  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoadingFeedback(true);
      const result = await getNewsletterFeedbackAction({ limit: 1000 });
      if ('error' in result) {
        setFeedback([]);
      } else {
        setFeedback(result);
      }
      setIsLoadingFeedback(false);
    };
    fetchFeedback();
  }, []);

  // Find the earliest subscriber date (used as data start for both charts)
  const firstDataDate = useMemo(() => {
    const dates = subscribers
      .filter(s => s.subscribedAt)
      .map(s => new Date(s.subscribedAt!));
    if (dates.length === 0) return undefined;
    return new Date(Math.min(...dates.map(d => d.getTime())));
  }, [subscribers]);

  // Fetch traffic data when time range changes
  useEffect(() => {
    const fetchTrafficData = async () => {
      setIsLoadingTraffic(true);
      const dateRange = getDateRangeForTimeRange(trafficTimeRange, trafficCustomDateRange, firstDataDate);
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');
      
      const result = await getGoogleAnalyticsDataAction(startDate, endDate);
      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error fetching traffic data',
          description: result.error,
        });
        setTrafficData([]);
      } else {
        setTrafficData(result);
      }
      setIsLoadingTraffic(false);
    };
    fetchTrafficData();
  }, [trafficTimeRange, trafficCustomDateRange, toast, firstDataDate]);

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  const chartData = useMemo(() => {
    const dateRange = getDateRangeForTimeRange(timeRange, customDateRange, firstDataDate);
    return generateChartData(subscribers, timeRange, dateRange);
  }, [subscribers, timeRange, customDateRange, firstDataDate]);

  // Process and aggregate traffic data based on selected time range
  const trafficChartData = useMemo(() => {
    if (!trafficData.length) return [];
    
    // For daily view or custom (short range), show daily data
    if (trafficTimeRange === 'day') {
      return trafficData.map(d => ({
        period: format(new Date(d.date), 'MMM d'),
        visitors: d.visitors,
        pageViews: d.pageViews,
      }));
    }
    
    // For custom, determine granularity based on range
    if (trafficTimeRange === 'custom') {
      const dateRange = getDateRangeForTimeRange(trafficTimeRange, trafficCustomDateRange);
      const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
      
      if (rangeDays <= 31) {
        // Daily for up to 1 month
        return trafficData.map(d => ({
          period: format(new Date(d.date), 'MMM d'),
          visitors: d.visitors,
          pageViews: d.pageViews,
        }));
      }
    }
    
    // Group data by the appropriate time period
    const groupedData: Map<string, { visitors: number; pageViews: number; label: string }> = new Map();
    
    trafficData.forEach(d => {
      const date = new Date(d.date);
      let key: string;
      let label: string;
      
      switch (trafficTimeRange) {
        case 'week':
        case 'custom': // For custom ranges > 31 days but <= 180 days
          const weekStart = startOfWeek(date);
          key = format(weekStart, 'yyyy-MM-dd');
          label = format(weekStart, 'MMM d');
          break;
        case 'month':
          key = format(date, 'yyyy-MM');
          label = format(date, 'MMM yyyy');
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          label = `Q${quarter} ${date.getFullYear()}`;
          break;
        case 'year':
          key = format(date, 'yyyy');
          label = format(date, 'yyyy');
          break;
        default:
          key = d.date;
          label = format(date, 'MMM d');
      }
      
      const existing = groupedData.get(key);
      if (existing) {
        existing.visitors += d.visitors;
        existing.pageViews += d.pageViews;
      } else {
        groupedData.set(key, { visitors: d.visitors, pageViews: d.pageViews, label });
      }
    });
    
    // Convert map to array and sort by key
    return Array.from(groupedData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        period: data.label,
        visitors: data.visitors,
        pageViews: data.pageViews,
      }));
  }, [trafficData, trafficTimeRange, trafficCustomDateRange]);

  // Calculate traffic totals
  const trafficTotals = useMemo(() => {
    return trafficData.reduce(
      (acc, d) => ({
        visitors: acc.visitors + d.visitors,
        pageViews: acc.pageViews + d.pageViews,
      }),
      { visitors: 0, pageViews: 0 }
    );
  }, [trafficData]);

  const feedbackChartData = useMemo(() => {
    if (!feedback.length) return [] as Array<{ date: string; period: string; avgScore: number; responses: number }>;

    const byDate = new Map<string, { sum: number; count: number }>();
    for (const entry of feedback) {
      if (!entry?.date) continue;
      if (typeof entry.score !== 'number') continue;
      const current = byDate.get(entry.date) ?? { sum: 0, count: 0 };
      current.sum += entry.score;
      current.count += 1;
      byDate.set(entry.date, current);
    }

    const dates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
    return dates.map((date) => {
      const stats = byDate.get(date)!;
      const avg = stats.count ? stats.sum / stats.count : 0;
      let label = date;
      try {
        label = format(new Date(date), 'MMM d');
      } catch {
        // ignore
      }
      return {
        date,
        period: label,
        avgScore: Math.round(avg * 100) / 100,
        responses: stats.count,
      };
    });
  }, [feedback]);

  const feedbackTotals = useMemo(() => {
    const scored = feedback.filter((f) => typeof f.score === 'number');
    const totalResponses = scored.length;
    const avgOverall = totalResponses
      ? scored.reduce((acc, f) => acc + (f.score as number), 0) / totalResponses
      : null;
    return {
      totalResponses,
      avgOverall: avgOverall !== null ? Math.round(avgOverall * 100) / 100 : null,
    };
  }, [feedback]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;

    setIsAdding(true);
    const result = await addSubscriberAction({ email, name });
    setIsAdding(false);

    if (result.success) {
      toast({
        title: 'Subscriber Added',
        description: `${name} (${email}) has been added to your mailing list.`,
      });
      setSubscribers(prev => [...prev, { name, email, subscribedAt: new Date().toISOString() }]);
      setName('');
      setEmail('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    }
  };

  return (
    <div className="bg-secondary min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Subscriber Management
            </h1>
          </div>
            <Button variant="outline" asChild>
              <Link href={withBasePath('/', basePath)}>Back to Newsroom</Link>
           </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Newsletter Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Newsletter Feedback</CardTitle>
              <CardDescription>
                Emoji ratings over time and full response history.
              </CardDescription>
              {!isLoadingFeedback && feedbackTotals.totalResponses > 0 ? (
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Total responses:</span>
                    <span className="font-semibold">{feedbackTotals.totalResponses.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Avg score:</span>
                    <span className="font-semibold">{feedbackTotals.avgOverall}/5</span>
                  </div>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {isLoadingFeedback ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : feedbackChartData.length > 0 ? (
                <ChartContainer config={feedbackChartConfig} className="h-[260px] w-full">
                  <LineChart data={feedbackChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      domain={[1, 5]}
                      allowDecimals
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      yAxisId="left"
                      dataKey="avgScore"
                      stroke="var(--color-avgScore)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Avg Score"
                    />
                    <Line
                      type="monotone"
                      yAxisId="right"
                      dataKey="responses"
                      stroke="var(--color-responses)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Responses"
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex justify-center py-10 text-muted-foreground">
                  No feedback data yet.
                </div>
              )}

              {/* History */}
              {!isLoadingFeedback && feedback.length > 0 ? (
                <div className="mt-6 space-y-2 max-h-[520px] overflow-auto">
                  {feedback.map((f) => (
                    <div key={f.id} className="p-3 rounded-md bg-background border">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.email}</p>
                          <p className="text-xs text-muted-foreground">{f.date || '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-foreground">Score: {typeof f.score === 'number' ? `${f.score}/5` : '—'}</p>
                          <p className="text-xs text-muted-foreground">Clicks: {typeof f.clickCount === 'number' ? f.clickCount : '—'}</p>
                        </div>
                      </div>
                      {f.comment ? (
                        <p className="mt-2 text-sm text-muted-foreground">{f.comment}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Website Traffic Chart */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Website Traffic
                  </CardTitle>
                  <CardDescription>
                    Visitors to jumpahead.ai
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={trafficTimeRange} onValueChange={(v) => setTrafficTimeRange(v as TimeRange)}>
                    <TabsList className="grid grid-cols-6 w-full">
                      <TabsTrigger value="day" className="text-xs px-2">Day</TabsTrigger>
                      <TabsTrigger value="week" className="text-xs px-2">Week</TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-2">Month</TabsTrigger>
                      <TabsTrigger value="quarter" className="text-xs px-2">Quarter</TabsTrigger>
                      <TabsTrigger value="year" className="text-xs px-2">Year</TabsTrigger>
                      <TabsTrigger value="custom" className="text-xs px-2">Custom</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              {trafficTimeRange === 'custom' && (
                <div className="flex items-center gap-2 mt-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !trafficCustomDateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {trafficCustomDateRange.from ? format(trafficCustomDateRange.from, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={trafficCustomDateRange.from}
                        onSelect={(date) => setTrafficCustomDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !trafficCustomDateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {trafficCustomDateRange.to ? format(trafficCustomDateRange.to, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={trafficCustomDateRange.to}
                        onSelect={(date) => setTrafficCustomDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {/* Traffic Summary Stats */}
              {!isLoadingTraffic && trafficData.length > 0 && (
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Visitors:</span>
                    <span className="font-semibold">{trafficTotals.visitors.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Page Views:</span>
                    <span className="font-semibold">{trafficTotals.pageViews.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingTraffic ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : trafficChartData.length > 0 ? (
                <ChartContainer config={trafficChartConfig} className="h-[300px] w-full">
                  <LineChart data={trafficChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="var(--color-visitors)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Visitors"
                    />
                    <Line
                      type="monotone"
                      dataKey="pageViews"
                      stroke="var(--color-pageViews)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Page Views"
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex justify-center py-16 text-muted-foreground">
                  No traffic data available. Make sure Google Analytics is configured.
                </div>
              )}
            </CardContent>
          </Card>
          {/* Subscriber Growth Chart */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Subscriber Growth</CardTitle>
                  <CardDescription>
                    Track how your subscriber base has grown over time
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <TabsList className="grid grid-cols-6 w-full">
                      <TabsTrigger value="day" className="text-xs px-2">Day</TabsTrigger>
                      <TabsTrigger value="week" className="text-xs px-2">Week</TabsTrigger>
                      <TabsTrigger value="month" className="text-xs px-2">Month</TabsTrigger>
                      <TabsTrigger value="quarter" className="text-xs px-2">Quarter</TabsTrigger>
                      <TabsTrigger value="year" className="text-xs px-2">Year</TabsTrigger>
                      <TabsTrigger value="custom" className="text-xs px-2">Custom</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              {timeRange === 'custom' && (
                <div className="flex items-center gap-2 mt-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !customDateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.from ? format(customDateRange.from, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.from}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !customDateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.to ? format(customDateRange.to, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.to}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="var(--color-cumulative)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="Total Subscribers"
                    />
                    <Line
                      type="monotone"
                      dataKey="subscribers"
                      stroke="var(--color-subscribers)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name="New Subscribers"
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex justify-center py-16 text-muted-foreground">
                  No subscriber data available for this time range
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add New Subscriber</CardTitle>
              <CardDescription>
                Enter an email and name to add to your newsletter mailing list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isAdding}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isAdding}
                    required
                  />
                </div>
                <Button type="submit" disabled={isAdding} className="w-full">
                  {isAdding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  Add Subscriber
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mailing List</CardTitle>
              <CardDescription>
                You have {subscribers.length} subscriber{subscribers.length !== 1 && 's'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {subscribers.length > 0 ? (
                    subscribers.map((sub, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-md bg-background border"
                      >
                        <div>
                          <p className="font-medium text-foreground">{sub.name}</p>
                          <p className="text-sm text-muted-foreground">{sub.email}</p>
                          {sub.lastFeedbackComment ? (
                            <p className="text-xs text-muted-foreground/80 mt-1">
                              {sub.lastFeedbackComment}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Subscribed on</p>
                            <p className="text-xs text-muted-foreground/80">{sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'}</p>
                            {typeof sub.lastFeedbackScore === 'number' ? (
                              <>
                                <p className="text-sm text-muted-foreground mt-2">Feedback</p>
                                <p className="text-xs text-muted-foreground/80">
                                  {sub.lastFeedbackScore}/5{sub.lastFeedbackAt ? ` · ${new Date(sub.lastFeedbackAt).toLocaleDateString()}` : ''}
                                </p>
                              </>
                            ) : null}
                        </div>
                        {/* Delete functionality can be added here */}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Your subscriber list is empty.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
