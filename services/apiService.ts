
import { API_BASE_URL } from '../constants';
import { VoxelData } from '../types';

/**
 * Interface for the Spring Boot Backend.
 * Expected Controller:
 * 
 * @RestController
 * @RequestMapping("/api/v1/voxels")
 * public class VoxelController { ... }
 */

export const apiService = {
  // Load initial world state
  getWorld: async (worldId: string = 'default'): Promise<VoxelData[]> => {
    try {
      // Start with an empty world for the "Ironman" experience
      return [];
    } catch (error) {
      console.error("Failed to fetch world from Spring Boot backend", error);
      return [];
    }
  },

  // Save a voxel placement
  placeVoxel: async (voxel: VoxelData): Promise<boolean> => {
    try {
      // await fetch(`${API_BASE_URL}/voxels`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(voxel)
      // });
      console.log(`[Backend] Saved Voxel: ${voxel.id}`);
      return true;
    } catch (error) {
      console.error("Failed to save voxel", error);
      return false;
    }
  },

  // Delete a voxel
  deleteVoxel: async (id: string): Promise<boolean> => {
    try {
      // await fetch(`${API_BASE_URL}/voxels/${id}`, { method: 'DELETE' });
      console.log(`[Backend] Deleted Voxel: ${id}`);
      return true;
    } catch (error) {
      console.error("Failed to delete voxel", error);
      return false;
    }
  }
};
