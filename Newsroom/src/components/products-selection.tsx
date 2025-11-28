
"use client";

import { useState, useEffect } from "react";
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
import { Rocket, PlusCircle, ArrowUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const MAX_SELECTIONS = 3;

type ProductsSelectionProps = {
  products: ProductLaunch[];
  selectedProducts: ProductLaunch[];
  setSelectedProducts: (products: ProductLaunch[]) => void;
};

export default function ProductsSelection({ products: initialProducts, selectedProducts, setSelectedProducts }: ProductsSelectionProps) {
  const [products, setProducts] = useState<ProductLaunch[]>(initialProducts);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // This effect ensures that if selected products are loaded from localStorage,
    // they are included in the main list.
    const allProducts = [...initialProducts, ...selectedProducts];
    const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values())
        .sort((a,b) => (b.upvotes || 0) - (a.upvotes || 0));
    setProducts(uniqueProducts);
  }, [initialProducts, selectedProducts]);

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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <AddProductDialog 
                onAddProduct={handleAddProduct}
                onClose={() => setIsDialogOpen(false)}
            />
          </Dialog>
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
                    <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
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
  
    const handleAdd = () => {
      if (newName && newDescription && newUrl) {
        onAddProduct({
            name: newName,
            description: newDescription,
            url: newUrl,
        });
        setNewName("");
        setNewDescription("");
        setNewUrl("");
        onClose();
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
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAdd}>Add Product</Button>
        </DialogFooter>
      </DialogContent>
    );
  }
