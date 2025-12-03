
'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { addSubscriberAction, getSubscribersAction, getGoogleAnalyticsDataAction, type AnalyticsDataPoint } from '../../actions';
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

function getDateRangeForTimeRange(timeRange: TimeRange, customRange?: DateRange): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);
  
  switch (timeRange) {
    case 'day':
      return { start: startOfDay(subDays(now, 30)), end }; // Last 30 days
    case 'week':
      return { start: startOfWeek(subWeeks(now, 12)), end }; // Last 12 weeks
    case 'month':
      return { start: startOfMonth(subMonths(now, 12)), end }; // Last 12 months
    case 'quarter':
      return { start: startOfQuarter(subQuarters(now, 8)), end }; // Last 8 quarters
    case 'year':
      return { start: startOfYear(subYears(now, 5)), end }; // Last 5 years
    case 'custom':
      if (customRange?.from && customRange?.to) {
        return { start: startOfDay(customRange.from), end: endOfDay(customRange.to) };
      }
      return { start: startOfDay(subDays(now, 30)), end };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
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
  
  while (current <= dateRange.end && iterations < maxIterations) {
    iterations++;
    let periodStart: Date;
    let periodEnd: Date;
    let label: string;
    let nextCurrent: Date;
    
    switch (timeRange) {
      case 'day':
        periodStart = startOfDay(current);
        periodEnd = endOfDay(current);
        label = format(current, 'MMM d');
        nextCurrent = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'custom': {
        // For custom ranges, determine granularity based on range length
        const rangeDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
        if (rangeDays <= 31) {
          // Daily for up to 1 month
          periodStart = startOfDay(current);
          periodEnd = endOfDay(current);
          label = format(current, 'MMM d');
          nextCurrent = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
        } else if (rangeDays <= 180) {
          // Weekly for up to 6 months
          periodStart = startOfWeek(current);
          periodEnd = endOfWeek(current);
          label = format(periodStart, 'MMM d');
          nextCurrent = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else {
          // Monthly for longer ranges
          periodStart = startOfMonth(current);
          periodEnd = endOfMonth(current);
          label = format(current, 'MMM yyyy');
          nextCurrent = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
        break;
      }
      case 'week':
        periodStart = startOfWeek(current);
        periodEnd = endOfWeek(current);
        label = format(periodStart, 'MMM d');
        nextCurrent = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
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
        nextCurrent = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Ensure we always advance to prevent infinite loop
    if (nextCurrent <= current) {
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
  const [isAdding, setIsAdding] = useState(false);
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
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
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  const chartData = useMemo(() => {
    const dateRange = getDateRangeForTimeRange(timeRange, customDateRange);
    return generateChartData(subscribers, timeRange, dateRange);
  }, [subscribers, timeRange, customDateRange]);

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
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Subscribed on</p>
                            <p className="text-xs text-muted-foreground/80">{sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'}</p>
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
