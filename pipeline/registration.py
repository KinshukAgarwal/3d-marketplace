import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from tqdm import tqdm

# Conditional Invertible Flow Networks for Point Cloud Generation
class ConditionalCouplingLayer(nn.Module):
    def __init__(self, input_dim, hidden_dim, condition_dim, mask):
        super(ConditionalCouplingLayer, self).__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.mask = mask
        
        # Scale and translation networks
        self.s_net = nn.Sequential(
            nn.Linear(input_dim + condition_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, input_dim)
        )
        
        self.t_net = nn.Sequential(
            nn.Linear(input_dim + condition_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LeakyReLU(0.2),
            nn.Linear(hidden_dim, input_dim)
        )
        
    def forward(self, x, condition, reverse=False):
        # Apply mask to get active and frozen components
        x_frozen = x * self.mask
        x_active = x * (1 - self.mask)
        
        # Concatenate frozen components with condition
        x_condition = torch.cat([x_frozen, condition], dim=-1)
        
        # Get scale and translation factors
        s = self.s_net(x_condition) * (1 - self.mask)
        t = self.t_net(x_condition) * (1 - self.mask)
        
        # Apply coupling operation
        if not reverse:
            # Forward transformation: y = x_frozen + (x_active * exp(s) + t)
            y = x_frozen + (x_active * torch.exp(s) + t)
            log_det = torch.sum(s, dim=1)
        else:
            # Inverse transformation: x = x_frozen + (x_active - t) * exp(-s)
            y = x_frozen + (x_active - t) * torch.exp(-s)
            log_det = -torch.sum(s, dim=1)
            
        return y, log_det

class ConditionalInvertibleFlow(nn.Module):
    def __init__(self, input_dim, hidden_dim, condition_dim, num_layers=4):
        super(ConditionalInvertibleFlow, self).__init__()
        self.layers = nn.ModuleList()
        
        # Create alternating masks for coupling layers
        for i in range(num_layers):
            if i % 2 == 0:
                mask = torch.zeros(input_dim)
                mask[:input_dim//2] = 1
            else:
                mask = torch.zeros(input_dim)
                mask[input_dim//2:] = 1
                
            self.layers.append(ConditionalCouplingLayer(input_dim, hidden_dim, condition_dim, mask))
            
    def forward(self, x, condition, reverse=False):
        log_det_sum = 0
        
        if not reverse:
            for layer in self.layers:
                x, log_det = layer(x, condition)
                log_det_sum += log_det
        else:
            for layer in reversed(self.layers):
                x, log_det = layer(x, condition, reverse=True)
                log_det_sum += log_det
                
        return x, log_det_sum

class PointCloudEncoder(nn.Module):
    def __init__(self, point_dim=3, latent_dim=128):
        super(PointCloudEncoder, self).__init__()
        
        # PointNet-like architecture
        self.conv1 = nn.Conv1d(point_dim, 64, 1)
        self.conv2 = nn.Conv1d(64, 128, 1)
        self.conv3 = nn.Conv1d(128, 256, 1)
        
        self.bn1 = nn.BatchNorm1d(64)
        self.bn2 = nn.BatchNorm1d(128)
        self.bn3 = nn.BatchNorm1d(256)
        
        # MLP for latent code
        self.fc1 = nn.Linear(256, 256)
        self.fc2 = nn.Linear(256, latent_dim)
        self.bn4 = nn.BatchNorm1d(256)
        
    def forward(self, x):
        # x shape: batch_size x num_points x point_dim
        x = x.transpose(2, 1)  # batch_size x point_dim x num_points
        
        # Apply PointNet
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.relu(self.bn3(self.conv3(x)))
        
        # Max pooling
        x = torch.max(x, 2, keepdim=True)[0]
        x = x.view(-1, 256)
        
        # MLP
        x = F.relu(self.bn4(self.fc1(x)))
        x = self.fc2(x)
        
        return x

class PointFlowModel(nn.Module):
    def __init__(self, point_dim=3, latent_dim=128, hidden_dim=256, num_flow_layers=8):
        super(PointFlowModel, self).__init__()
        
        # Encoder for point clouds
        self.encoder = PointCloudEncoder(point_dim, latent_dim)
        
        # Prior distribution parameters (learnable)
        self.prior_mean = nn.Parameter(torch.zeros(latent_dim))
        self.prior_logvar = nn.Parameter(torch.zeros(latent_dim))
        
        # Flow model for point generation
        self.flow = ConditionalInvertibleFlow(
            input_dim=point_dim,
            hidden_dim=hidden_dim,
            condition_dim=latent_dim,
            num_layers=num_flow_layers
        )
        
    def encode(self, point_cloud):
        # Encode point cloud to latent vector
        z = self.encoder(point_cloud)
        return z
    
    def sample_prior(self, batch_size):
        # Sample from prior distribution
        eps = torch.randn(batch_size, len(self.prior_mean), device=self.prior_mean.device)
        z = self.prior_mean + eps * torch.exp(0.5 * self.prior_logvar)
        return z
    
    def generate(self, batch_size, num_points, latent_code=None):
        # Generate point cloud from latent code or sample from prior
        if latent_code is None:
            latent_code = self.sample_prior(batch_size)
            
        # Sample points from base distribution (Gaussian)
        base_points = torch.randn(batch_size, num_points, 3, device=latent_code.device)
        
        # Transform points through the flow
        generated_points = []
        
        # Process in smaller batches to avoid memory issues
        for i in range(0, num_points, 1000):
            end_idx = min(i + 1000, num_points)
            batch_points = base_points[:, i:end_idx, :]
            
            # Expand latent code for each point
            expanded_latent = latent_code.unsqueeze(1).expand(-1, end_idx - i, -1)
            
            # Apply flow transformation
            transformed_points, _ = self.flow(batch_points, expanded_latent, reverse=True)
            generated_points.append(transformed_points)
            
        generated_points = torch.cat(generated_points, dim=1)
        return generated_points
    
    def forward(self, point_cloud):
        # Encode point cloud
        latent_code = self.encode(point_cloud)
        
        # Expand latent code for each point
        batch_size, num_points, _ = point_cloud.shape
        expanded_latent = latent_code.unsqueeze(1).expand(-1, num_points, -1)
        
        # Transform points through the flow
        transformed_points, log_det = self.flow(point_cloud, expanded_latent)
        
        # Calculate prior probability
        prior_logprob = -0.5 * torch.sum(
            self.prior_logvar + 
            (latent_code - self.prior_mean)**2 / torch.exp(self.prior_logvar) + 
            torch.log(torch.tensor(2 * np.pi)),
            dim=1
        )
        
        # Calculate probability of transformed points (standard normal)
        point_logprob = -0.5 * torch.sum(
            transformed_points**2 + torch.log(torch.tensor(2 * np.pi)),
            dim=(1, 2)
        )
        
        # Total log probability
        log_prob = prior_logprob + point_logprob + log_det
        
        return -log_prob.mean()  # Negative log likelihood

# Function to merge multiple point clouds using the model
def merge_point_clouds(model, point_clouds, num_output_points=2048):
    """
    Merge multiple point clouds using the generative model
    
    Args:
        model: Trained PointFlowModel
        point_clouds: List of point clouds to merge
        num_output_points: Number of points in the output point cloud
        
    Returns:
        Merged point cloud as numpy array
    """
    model.eval()
    
    # Convert point clouds to tensors if they aren't already
    pc_tensors = []
    for pc in point_clouds:
        if isinstance(pc, np.ndarray):
            pc_tensors.append(torch.from_numpy(pc).float())
        else:
            pc_tensors.append(pc)
    
    # Encode each point cloud to get latent codes
    latent_codes = []
    with torch.no_grad():
        for pc in pc_tensors:
            # Add batch dimension if needed
            if len(pc.shape) == 2:
                pc = pc.unsqueeze(0)
            
            # Encode
            latent = model.encode(pc)
            latent_codes.append(latent)
    
    # Average the latent codes
    avg_latent = torch.mean(torch.stack(latent_codes), dim=0)
    
    # Generate merged point cloud
    with torch.no_grad():
        merged_pc = model.generate(1, num_output_points, avg_latent)
    
    return merged_pc.squeeze(0).cpu().numpy()

# Example usage
def train_point_flow_model(point_clouds, batch_size=32, epochs=100, lr=0.001):
    """
    Train the PointFlow model on a dataset of point clouds
    
    Args:
        point_clouds: Dataset of point clouds (N x num_points x 3)
        batch_size: Batch size for training
        epochs: Number of training epochs
        lr: Learning rate
        
    Returns:
        Trained model
    """
    # Create model
    model = PointFlowModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    # Create data loader
    dataset = torch.utils.data.TensorDataset(torch.tensor(point_clouds, dtype=torch.float32))
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # Training loop
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        for batch in tqdm(dataloader, desc=f"Epoch {epoch+1}/{epochs}"):
            optimizer.zero_grad()
            
            # Forward pass
            loss = model(batch[0])
            
            # Backward pass
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(dataloader):.6f}")
    
    return model
