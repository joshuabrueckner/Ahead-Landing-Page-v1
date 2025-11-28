
"use client";

import { useState, useEffect, useRef } from "react";
import type { ProductLaunch } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Plus, ArrowUp, Loader, Sparkles, RotateCcw, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { generateProductOutcomeSentenceAction } from "@/app/actions";

const MAX_SELECTIONS = 3;

type ProductsSelectionProps = {
  products: ProductLaunch[];
  selectedProducts: ProductLaunch[];
  setSelectedProducts: (products: ProductLaunch[]) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  maxDate: string;
};

export default function ProductsSelection({ products: initialProducts, selectedProducts, setSelectedProducts, selectedDate, onDateChange, maxDate }: ProductsSelectionProps) {
  const [products, setProducts] = useState<ProductLaunch[]>(initialProducts);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [productSummaries, setProductSummaries] = useState<Record<string, string>>({});
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  const [regeneratingSummaries, setRegeneratingSummaries] = useState<Record<string, boolean>>({});
  const [textDialogProduct, setTextDialogProduct] = useState<ProductLaunch | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // This effect ensures that if selected products are loaded from localStorage,
    // they are included in the main list.
    const allProducts = [...initialProducts, ...selectedProducts];
    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values())
        .sort((a,b) => (b.upvotes || 0) - (a.upvotes || 0));
    setProducts(uniqueProducts);
  }, [initialProducts, selectedProducts]);

  useEffect(() => {
    setProductSummaries(prev => {
      const next = { ...prev };
      products.forEach(product => {
        if (product.summary && !next[product.id]) {
          next[product.id] = product.summary;
        }
      });
      return next;
    });
  }, [products]);

  const handleGenerateSummaries = async () => {
    if (isGeneratingSummaries) return;
    const queue = products.filter(product => !productSummaries[product.id]);

    if (queue.length === 0) {
      toast({ title: "All summaries ready", description: "Every product already has a description." });
      return;
    }

    setIsGeneratingSummaries(true);
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const chunkSize = 3;
    const pauseMs = 1000;
    let abort = false;

    for (let i = 0; i < queue.length && !abort; i += chunkSize) {
      const batch = queue.slice(i, i + chunkSize);
      await Promise.all(batch.map(async (product) => {
        console.log(`[Products] Generating summary for: ${product.name}`);
        try {
          const result = await generateProductOutcomeSentenceAction({
            name: product.name,
            description: product.description,
            url: product.url,
          });

          if (result.error) {
            toast({ title: `Couldn't summarize ${product.name}`, description: result.error, variant: "destructive" });
            if (/429|quota/i.test(result.error)) {
              abort = true;
            }
          } else if (result.summary) {
            setProductSummaries(prev => ({
              ...prev,
              [product.id]: result.summary as string,
            }));
          }
        } catch (error: any) {
          const message = error?.message || "Unexpected error";
          toast({ title: `Couldn't summarize ${product.name}`, description: message, variant: "destructive" });
          if (/429|quota/i.test(message)) {
            abort = true;
          }
        }
      }));

      if (!abort && i + chunkSize < queue.length) {
        await delay(pauseMs);
      }
    }

    setIsGeneratingSummaries(false);
  };

  useEffect(() => {
    setDateInput(selectedDate);
  }, [selectedDate]);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    if (value) {
      onDateChange(value);
    }
  };

  const handleDateButtonClick = () => {
    if (dateInputRef.current) {
      const input = dateInputRef.current as HTMLInputElement & { showPicker?: () => void };
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    }
  };

  const dayLabel = (() => {
    if (!dateInput) return "--";
    const parts = dateInput.split("-");
    const dayPart = parts[2];
    if (!dayPart) return "--";
    return String(parseInt(dayPart, 10));
  })();

  const selectedIds = new Set(selectedProducts.map(p => p.id));

  const handleSelect = (product: ProductLaunch) => {
    const isSelected = selectedIds.has(product.id);
    let newSelection: ProductLaunch[];
    if (isSelected) {
      newSelection = selectedProducts.filter(p => p.id !== product.id);
    } else {
      if (selectedProducts.length < MAX_SELECTIONS) {
        newSelection = [...selectedProducts, product];
      } else {
        return;
      }
    }
    setSelectedProducts(newSelection);
  };

  const handleAddProduct = (newProduct: Omit<ProductLaunch, 'id' | 'upvotes'>) => {
    const productToAdd: ProductLaunch = {
        id: (Math.random() + 1).toString(36).substring(7), // simple random id
        upvotes: 0,
        ...newProduct,
    };
    setProducts(prev => [productToAdd, ...prev]);
    if(selectedProducts.length < MAX_SELECTIONS) {
        setSelectedProducts([...selectedProducts, productToAdd]);
    }
  };

  const handleRegenerateSummary = async (product: ProductLaunch) => {
    if (regeneratingSummaries[product.id]) return;

    setRegeneratingSummaries(prev => ({ ...prev, [product.id]: true }));
    try {
      const result = await generateProductOutcomeSentenceAction({
        name: product.name,
        description: product.description,
        url: product.url,
      });

      if (result.error) {
        toast({
          title: `Couldn't regenerate ${product.name}`,
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      if (result.summary) {
        setProductSummaries(prev => ({
          ...prev,
          [product.id]: result.summary as string,
        }));
        toast({ title: `${product.name} updated`, description: "Gemini provided a fresh sentence." });
      }
    } catch (error: any) {
      toast({
        title: `Couldn't regenerate ${product.name}`,
        description: error?.message || "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setRegeneratingSummaries(prev => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    }
  };
  
  const selectionCount = selectedProducts.length;

  return (
    <TooltipProvider delayDuration={200}>
    <>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline">Select Top AI Products</CardTitle>
              <CardDescription>
                Choose {MAX_SELECTIONS} products for the newsletter.
              </CardDescription>
            </div>
          </div>
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
              <div>
                <Input
                  ref={dateInputRef}
                  type="date"
                  value={dateInput}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className="sr-only"
                  max={maxDate}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      onClick={handleDateButtonClick}
                      className="h-10 w-10 rounded-full font-semibold"
                      aria-label="Jump to date"
                    >
                      {dayLabel}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump to date</TooltipContent>
                </Tooltip>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={handleGenerateSummaries}
                    className="h-10 w-10 rounded-full"
                    disabled={isGeneratingSummaries}
                    aria-label="Generate product summaries"
                  >
                    {isGeneratingSummaries ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate summaries</TooltipContent>
              </Tooltip>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="default" size="icon" className="h-10 w-10 rounded-full" aria-label="Add product">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add product</TooltipContent>
                </Tooltip>
                <AddProductDialog 
                    onAddProduct={handleAddProduct}
                    onClose={() => setIsDialogOpen(false)}
                />
              </Dialog>
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product, index) => {
            const isSelected = selectedIds.has(product.id);
            const selectionIndex = isSelected ? selectedProducts.findIndex(p => p.id === product.id) : -1;
            return (
              <div key={product.id}>
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground font-bold w-5 text-center">
                      {isSelected ? `${selectionIndex + 1}.` : ''}
                    </span>
                    <Checkbox
                      id={`product-${product.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleSelect(product)}
                      disabled={!isSelected && selectionCount >= MAX_SELECTIONS}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="flex-1">
                      <label htmlFor={`product-${product.id}`} className="text-foreground hover:text-primary cursor-pointer leading-tight">
                        <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          <span className="font-semibold">{product.name}</span>
                          {product.tagline ? (
                            <span className="font-normal text-foreground">
                              : <span className="text-muted-foreground font-normal">{product.tagline}</span>
                            </span>
                          ) : null}
                        </a>
                      </label>
                      { (productSummaries[product.id] || product.summary) && (
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {productSummaries[product.id] || product.summary}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground/80 mt-2 font-medium">
                          <ArrowUp className="w-3 h-3 mr-1 text-green-500" /> {(product.upvotes || 0).toLocaleString()} upvotes
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full border border-border/40 bg-secondary/30 text-muted-foreground hover:text-primary"
                            aria-label={`Regenerate summary for ${product.name}`}
                            onClick={() => handleRegenerateSummary(product)}
                            disabled={!!regeneratingSummaries[product.id]}
                          >
                            {regeneratingSummaries[product.id] ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Regenerate sentence</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-full text-muted-foreground"
                            aria-label={`Show extracted text for ${product.name}`}
                            onClick={() => setTextDialogProduct(product)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View extracted text</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                {index < products.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="bg-secondary/50 p-4 border-t text-sm text-muted-foreground flex justify-center">
        <span>{selectionCount} of {MAX_SELECTIONS} products selected.</span>
      </CardFooter>
    </Card>
    <Dialog open={!!textDialogProduct} onOpenChange={(open) => { if (!open) setTextDialogProduct(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extracted Text</DialogTitle>
          <DialogDescription>
            Gemini context for {textDialogProduct?.name ?? "this product"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-md bg-muted/60 p-4 text-sm leading-relaxed whitespace-pre-line">
          {textDialogProduct?.description?.trim() || textDialogProduct?.tagline || "No extracted text available for this product."}
        </div>
      </DialogContent>
    </Dialog>
    </>
    </TooltipProvider>
  );
}


function AddProductDialog({ onAddProduct, onClose }: { onAddProduct: (product: Omit<ProductLaunch, 'id' | 'upvotes'>) => void, onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [newTagline, setNewTagline] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    const trimmedName = newName.trim();
    const trimmedTagline = newTagline.trim();
    const trimmedDescription = newDescription.trim();
    const trimmedUrl = newUrl.trim();

    if (!trimmedName || !trimmedDescription || !trimmedUrl) {
      toast({ title: "Missing fields", description: "Please provide name, description, and URL (tagline optional).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const summaryResult = await generateProductOutcomeSentenceAction({
        name: trimmedName,
        description: trimmedDescription,
        url: trimmedUrl,
      });

      if (summaryResult.error) {
        toast({ title: "Gemini error", description: summaryResult.error, variant: "destructive" });
      }

      onAddProduct({
        name: trimmedName,
        tagline: trimmedTagline || undefined,
        description: trimmedDescription,
        url: trimmedUrl,
        summary: summaryResult.summary || trimmedDescription,
      });
      setNewName("");
      setNewTagline("");
      setNewDescription("");
      setNewUrl("");
      onClose();
    } catch (error: any) {
      console.error("Failed to add custom product:", error);
      toast({ title: "Unexpected error", description: error?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a Custom Product</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline (shown next to name)</Label>
          <Input id="tagline" value={newTagline} onChange={(e) => setNewTagline(e.target.value)} placeholder="e.g. YouTube video insights for all" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Gemini context (kept private)</Label>
          <Input id="description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detail how the product works" />
        </div>
         <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleAdd} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Product"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
