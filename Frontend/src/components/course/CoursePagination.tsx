import { Button } from "@/components/ui/button";

interface CoursePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const CoursePagination: React.FC<CoursePaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-12 flex justify-center">
      <Button 
        variant="outline" 
        className="me-2"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        السابق
      </Button>
      
      {pages.map((page) => (
        <Button 
          key={page}
          variant={page === currentPage ? "default" : "outline"} 
          className="mx-1"
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}

      <Button 
        variant="outline" 
        className="ms-2"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        التالي
      </Button>
    </div>
  );
};

export default CoursePagination;
