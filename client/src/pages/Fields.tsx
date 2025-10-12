import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FieldList from '@/components/Fields/FieldList';
import FieldForm from '@/components/Fields/FieldForm';

const Fields = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [refresh, setRefresh] = useState(0);

  const handleEdit = (field: any) => {
    setEditingField(field);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setRefresh(prev => prev + 1);
    setShowForm(false);
    setEditingField(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-bold">Field Management</h1>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Field
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <FieldList onEdit={handleEdit} refresh={refresh} />
      </main>

      <FieldForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingField(null);
        }}
        onSuccess={handleSuccess}
        field={editingField}
      />
    </div>
  );
};

export default Fields;
