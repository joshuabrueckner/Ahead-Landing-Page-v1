
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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Plus, ArrowUp, Loader } from "lucide-react";
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
  const generatingSummariesRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    let cancelled = false;
    const generateMissingSummaries = async () => {
      for (const product of products) {
        if (productSummaries[product.id]) continue;
        if (generatingSummariesRef.current.has(product.id)) continue;

        generatingSummariesRef.current.add(product.id);
        try {
          const result = await generateProductOutcomeSentenceAction({
            name: product.name,
            description: product.description,
            url: product.url,
          });
          if (!cancelled) {
            setProductSummaries(prev => ({
              ...prev,
              [product.id]: result.summary || product.description,
            }));
          }
        } catch (error) {
          console.error("Failed to generate summary for product", product.name, error);
          if (!cancelled) {
            toast({ title: "Summary error", description: `Couldn't summarize ${product.name}.`, variant: "destructive" });
            setProductSummaries(prev => ({
              ...prev,
              [product.id]: product.description,
            }));
          }
        } finally {
          generatingSummariesRef.current.delete(product.id);
        }
      }
    };

    generateMissingSummaries();

    return () => {
      cancelled = true;
    };
  }, [products, productSummaries, toast]);

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
  
  const selectionCount = selectedProducts.length;

  return (
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
                  <div className="flex-grow">
                    <label htmlFor={`product-${product.id}`} className="font-semibold text-foreground hover:text-primary cursor-pointer">
                      <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {product.name}
                      </a>
                    </label>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {productSummaries[product.id] || product.summary || product.description}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground/80 mt-2 font-medium">
                        <ArrowUp className="w-3 h-3 mr-1 text-green-500" /> {(product.upvotes || 0).toLocaleString()} upvotes
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
  );
}


function AddProductDialog({ onAddProduct, onClose }: { onAddProduct: (product: Omit<ProductLaunch, 'id' | 'upvotes'>) => void, onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    const trimmedName = newName.trim();
    const trimmedDescription = newDescription.trim();
    const trimmedUrl = newUrl.trim();

    if (!trimmedName || !trimmedDescription || !trimmedUrl) {
      toast({ title: "Missing fields", description: "Please provide name, description, and URL.", variant: "destructive" });
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
        description: trimmedDescription,
        url: trimmedUrl,
        summary: summaryResult.summary || trimmedDescription,
      });
      setNewName("");
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
          <Label htmlFor="description">Description</Label>
          <Input id="description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
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
