import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import FieldMap from '@/components/Map/FieldMap';

const fieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  description: z.string().optional(),
});

interface FieldFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  field?: any;
}

const FieldForm = ({ open, onClose, onSuccess, field }: FieldFormProps) => {
  const [polygon, setPolygon] = useState<number[][]>([]);
  const [area, setArea] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: field?.name || '',
      description: field?.description || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof fieldSchema>) => {
    if (polygon.length === 0 && !field) {
      toast({
        title: 'Please draw a field boundary',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fieldData = {
        name: values.name,
        description: values.description || null,
        polygon: polygon.length > 0 ? polygon : field?.polygon,
        area_hectares: area > 0 ? area : field?.area_hectares,
        user_id: user.id,
      };

      if (field) {
        const { error } = await supabase
          .from('fields')
          .update(fieldData)
          .eq('id', field.id);
        if (error) throw error;
        toast({ title: 'Field updated successfully' });
      } else {
        const { error } = await supabase.from('fields').insert(fieldData);
        if (error) throw error;
        toast({ title: 'Field created successfully' });
      }

      onSuccess();
      onClose();
      form.reset();
      setPolygon([]);
      setArea(0);
    } catch (error: any) {
      toast({
        title: 'Error saving field',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Field' : 'Create New Field'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Name</FormLabel>
                  <FormControl>
                    <Input defaultValue={field?.name} placeholder="North Field" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      defaultValue={field?.description}
                      placeholder="Additional details about this field..."
                      {...fieldProps}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel className="mb-2 block">Field Boundary</FormLabel>
              <p className="text-sm text-muted-foreground mb-4">
                Click on the map to draw the field boundary polygon (Ctrl + z for undo)
              </p>
              <FieldMap
                onPolygonChange={(coords, areaHa) => {
                  setPolygon(coords);
                  setArea(areaHa);
                }}
                initialPolygon={field?.polygon}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : field ? 'Update Field' : 'Create Field'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default FieldForm;
