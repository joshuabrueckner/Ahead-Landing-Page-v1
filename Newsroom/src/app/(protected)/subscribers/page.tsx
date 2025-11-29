
'use client';

import { useState, useEffect } from 'react';
import { AppLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { addSubscriberAction, getSubscribersAction } from '../../actions';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { getBasePath, withBasePath } from '@/lib/base-path';

type Subscriber = {
  email: string;
  name: string;
  subscribedAt: string | null;
};

export default function SubscribersPage() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [basePath, setBasePath] = useState<string>(() => getBasePath());

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
        <div className="max-w-2xl mx-auto space-y-8">
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
