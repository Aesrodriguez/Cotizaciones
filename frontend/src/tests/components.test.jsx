import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Pagination from '../components/common/Pagination';

describe('Modal', () => {
  it('no renderiza cuando open=false', () => {
    render(<Modal open={false} onClose={() => {}} title="Test"><p>Contenido</p></Modal>);
    expect(screen.queryByText('Contenido')).toBeNull();
  });

  it('renderiza cuando open=true', () => {
    render(<Modal open={true} onClose={() => {}} title="Mi Modal"><p>Contenido visible</p></Modal>);
    expect(screen.getByText('Mi Modal')).toBeInTheDocument();
    expect(screen.getByText('Contenido visible')).toBeInTheDocument();
  });

  it('llama onClose al hacer click en X', () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Test"><p>x</p></Modal>);
    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('muestra mensaje y botones cuando open=true', () => {
    render(
      <ConfirmDialog open={true} onClose={() => {}} onConfirm={() => {}} title="Confirmar" message="¿Estás seguro?" />
    );
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('no renderiza con una sola página', () => {
    const { container } = render(<Pagination page={1} pages={1} total={5} limit={10} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza botones cuando hay más de una página', () => {
    render(<Pagination page={1} pages={3} total={25} limit={10} onChange={() => {}} />);
    expect(screen.getByText('Siguiente ›')).toBeInTheDocument();
  });

  it('llama onChange al navegar', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pages={3} total={25} limit={10} onChange={onChange} />);
    fireEvent.click(screen.getByText('Siguiente ›'));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
